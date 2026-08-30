import { app, autoUpdater as electronAutoUpdater, BrowserWindow, clipboard, ipcMain, dialog, session, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import Database from 'better-sqlite3'
import path from 'path'
import { DATABASE_FILE_NAME, initDatabase, getDatabase } from './database'
import { decrypt, decryptBuffer, encrypt, encryptBuffer, encryptIfNeeded } from './crypto'
import {
  PROTECTED_TABLES,
  SERVICE_INFO_TABLES,
  assertCountsNotReduced,
  assertDatabaseIntegrity,
  assertFullWalCheckpoint,
  backupDatabaseIfExists,
  copySqliteSnapshotIfMissing,
  getExistingTableCounts,
  restoreDatabaseFromBackup,
  type CoreTableCounts,
} from './databaseSafety'
import {
  SERVICE_INFO_BACKUP_VERSION,
  captureLegacyServiceAccountLinks,
  importServiceInfoBackupData,
  readServiceInfoBackupData,
  restoreLegacyServiceAccountLinks,
} from './serviceInfoBackup'
import { readPreferences, replacePreferences, resetPreferences, updatePreferences } from './preferencesStore'
import { registerServiceInfoIpc } from './serviceInfoRepository'
import { assertValidJsonBackup } from './backupValidation'
import {
  normalizeAccountPlatform,
  normalizeOtpAlgorithm,
  normalizeOtpCounter,
  normalizeOtpDigits,
  normalizeOtpPeriod,
  normalizeOtpType,
} from './accountTotpRepository'
import { pickTagColor } from '../shared/tagColors'
import { normalizeTotpSource } from '../shared/totpSource'
import { createClipboardGuard } from './clipboardGuard'
import { registerAccountIpc } from './ipc/accountsIpc'
import { registerTotpIpc } from './ipc/totpIpc'
import { prepareTotpQrImage } from './totpQrImageValidation'
import { recoverDatabaseAfterFailedImport } from './databaseImportRecovery'
import { UpdaterController } from './updaterController'
import { createUpdaterLogger } from './updaterLogger'
import { resolveUserDataProfile, type UserDataProfile } from './userDataProfile'
import {
  read as readUpdateAttempt,
  reconcile as reconcileUpdateAttempt,
  remove as removeUpdateAttempt,
  write as writeUpdateAttempt,
} from './updaterStateStore'
import type { UpdateSnapshot } from '../shared/update'
import type { RuntimeDataInfo } from '../shared/runtimeData'
import fs from 'fs'

let mainWindow: BrowserWindow | null = null
const APP_ID = 'com.personal.credvaultix'
const APP_NAME = 'CredVaultix'
const RELEASE_URL = 'https://github.com/zzf-857/CredVaultix/releases/latest'
const LEGACY_DATABASE_FILE_NAME = 'account-manager.db'
const DATA_TABLES = [...PROTECTED_TABLES, ...SERVICE_INFO_TABLES]
const CLIPBOARD_AUTO_CLEAR_MS = 30_000
let isQuittingForUpdate = false
let updaterController: UpdaterController | null = null
let updateSnapshot: UpdateSnapshot | null = null
let activeUserDataProfile: UserDataProfile
let hasUnsavedRendererChanges = false

app.setName(APP_NAME)

function configureAppIdentity() {
  app.setName(APP_NAME)
  app.setAppUserModelId(APP_ID)
  activeUserDataProfile = resolveUserDataProfile({
    appDataPath: app.getPath('appData'),
    cwd: process.cwd(),
    argv: process.argv,
    env: process.env,
    isPackaged: app.isPackaged,
  })
  app.setPath('userData', activeUserDataProfile.path)
}

configureAppIdentity()
const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
}

function getAppIconPath() {
  const candidates = [
    app.isPackaged
      ? path.join(process.resourcesPath, 'assets', 'app.ico')
      : path.join(process.cwd(), 'assets', 'app.ico'),
    path.join(__dirname, '../assets/app.ico'),
  ]

  return candidates.find((candidate) => fs.existsSync(candidate))
}

function isSqliteDatabasePath(filePath: string) {
  return path.extname(filePath).toLowerCase() === '.db'
}

function quitAfterFatalDatabaseRecovery(error: Error): never {
  console.error('Fatal database recovery failure:', error)
  dialog.showErrorBox(
    'CredVaultix 数据库恢复失败',
    `${error.message}\n\n程序将立即退出，以避免继续访问已关闭或不完整的数据库。请保留数据目录及其中仍可用的迁移或导入前备份。`
  )
  hasUnsavedRendererChanges = false
  app.quit()
  throw error
}

function backupCurrentDatabaseBeforeImport(currentDb: Database.Database) {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, DATABASE_FILE_NAME)

  assertFullWalCheckpoint(currentDb)
  const expectedCounts = getExistingTableCounts(currentDb, DATA_TABLES)
  const backup = backupDatabaseIfExists(
    dbPath,
    userDataPath,
    new Date(),
    'import',
    (backupPath) => validateSqliteBackup(backupPath, expectedCounts)
  )
  if (!backup.created || !backup.filePath || !fs.existsSync(backup.filePath)) {
    throw new Error('导入已中止：无法创建当前数据库的安全备份')
  }
  return backup
}

function copyFileIfMissing(sourcePath: string, targetPath: string) {
  if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) return false
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.copyFileSync(sourcePath, targetPath)
  return true
}

function copyDirectoryIfMissing(sourcePath: string, targetPath: string) {
  if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) return false
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.cpSync(sourcePath, targetPath, { recursive: true })
  return true
}

async function migrateLegacyUserDataToCredVaultix() {
  const appDataPath = app.getPath('appData')
  const targetUserDataPath = app.getPath('userData')
  const targetDbPath = path.join(targetUserDataPath, DATABASE_FILE_NAME)
  const legacySources = [
    {
      name: 'account-manager',
      directory: path.join(appDataPath, 'account-manager'),
      databaseFileName: LEGACY_DATABASE_FILE_NAME,
    },
    {
      name: 'AccountManager',
      directory: path.join(appDataPath, 'AccountManager'),
      databaseFileName: LEGACY_DATABASE_FILE_NAME,
    },
    {
      name: 'prompt-manager',
      directory: path.join(appDataPath, 'prompt-manager'),
      databaseFileName: 'prompt-manager.db',
    },
  ]

  for (const source of legacySources) {
    if (path.resolve(source.directory) === path.resolve(targetUserDataPath)) {
      continue
    }

    const sourceDbPath = path.join(source.directory, source.databaseFileName)
    try {
      if (await copySqliteSnapshotIfMissing(sourceDbPath, targetDbPath)) {
        console.log(`Migrated legacy ${source.name} database into ${APP_NAME}`)
      }
    } catch (error) {
      throw new Error(
        `无法安全迁移旧数据库“${sourceDbPath}”；原数据库未被修改`,
        { cause: error }
      )
    }

    try {
      copyFileIfMissing(
        path.join(source.directory, 'preferences.json'),
        path.join(targetUserDataPath, 'preferences.json')
      )
      copyDirectoryIfMissing(
        path.join(source.directory, 'Local Storage'),
        path.join(targetUserDataPath, 'Local Storage')
      )

      if (fs.existsSync(source.directory)) {
        for (const entry of fs.readdirSync(source.directory)) {
          if (
            entry.endsWith('.db') &&
            entry !== source.databaseFileName &&
            !entry.includes('SharedStorage') &&
            !entry.includes('LOCK')
          ) {
            copyFileIfMissing(
              path.join(source.directory, entry),
              path.join(targetUserDataPath, entry)
            )
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to migrate auxiliary data from ${source.name}:`, error)
    }
  }
}

function validateSqliteBackup(filePath: string, expectedCounts?: CoreTableCounts) {
  const candidate = new Database(filePath, { readonly: true, fileMustExist: true })
  try {
    assertDatabaseIntegrity(candidate)

    const requiredTables = ['accounts', 'totp_accounts']
    for (const tableName of requiredTables) {
      const row = candidate
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(tableName) as { name?: string } | undefined
      if (!row?.name) {
        throw new Error(`SQLite 备份缺少必要数据表：${tableName}`)
      }
    }

    if (expectedCounts) {
      assertCountsNotReduced(
        expectedCounts,
        getExistingTableCounts(candidate, Object.keys(expectedCounts))
      )
    }
  } finally {
    candidate.close()
  }
}

function prepareDatabaseForUpdateInstall() {
  if (hasUnsavedRendererChanges) {
    throw new Error('请先保存或取消当前账号编辑，再安装更新')
  }

  const database = getDatabase()
  if (!database?.open) {
    throw new Error('数据库当前不可用，已中止更新安装')
  }

  const userDataPath = app.getPath('userData')
  const databasePath = path.join(userDataPath, DATABASE_FILE_NAME)
  const expectedCounts = getExistingTableCounts(database, DATA_TABLES)
  assertFullWalCheckpoint(database)
  const backup = backupDatabaseIfExists(
    databasePath,
    userDataPath,
    new Date(),
    'update',
    (backupPath) => validateSqliteBackup(backupPath, expectedCounts)
  )
  if (!backup.created || !backup.filePath || !fs.existsSync(backup.filePath)) {
    throw new Error('无法创建更新前数据库备份，已中止更新安装')
  }
  return backup.filePath
}

function setupAutoUpdater() {
  const userDataPath = app.getPath('userData')
  const logFilePath = path.join(userDataPath, 'logs', 'updater.log')
  const attemptFilePath = path.join(userDataPath, 'updater-state.json')
  const logger = createUpdaterLogger(logFilePath)

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.logger = logger

  const storedAttempt = readUpdateAttempt(attemptFilePath)
  const reconciledAttempt = reconcileUpdateAttempt(storedAttempt, app.getVersion())
  let initialError: string | undefined
  if (reconciledAttempt?.status === 'installed') {
    logger.info(`Update to v${reconciledAttempt.targetVersion} completed successfully`)
    try {
      removeUpdateAttempt(attemptFilePath)
    } catch (error) {
      logger.warn('Failed to remove completed updater state', error)
    }
  } else if (reconciledAttempt) {
    if (reconciledAttempt !== storedAttempt) {
      try {
        writeUpdateAttempt(attemptFilePath, reconciledAttempt)
      } catch (error) {
        logger.warn('Failed to persist reconciled updater state', error)
      }
    }
    if (reconciledAttempt.status === 'interrupted' || reconciledAttempt.status === 'failed') {
      initialError = `上次更新到 v${reconciledAttempt.targetVersion} 未完成，可重新检查并安装`
      logger.warn(reconciledAttempt.error || initialError)
    }
  } else if (fs.existsSync(attemptFilePath)) {
    logger.warn('Ignored an invalid updater state file')
  }

  updaterController = new UpdaterController({
    updater: autoUpdater,
    currentVersion: app.getVersion(),
    releaseUrl: RELEASE_URL,
    logger,
    initialError,
    isPackaged: app.isPackaged,
    executablePath: process.execPath,
    productName: APP_NAME,
    portableExecutableDir: process.env.PORTABLE_EXECUTABLE_DIR,
    portableExecutableFile: process.env.PORTABLE_EXECUTABLE_FILE,
    fileExists: fs.existsSync,
    prepareForInstall: () => {
      const backupPath = prepareDatabaseForUpdateInstall()
      logger.info(`Verified pre-update database backup: ${backupPath}`)
    },
    persistAttempt: (attempt) => writeUpdateAttempt(attemptFilePath, attempt),
    requestInstall: () => {
      isQuittingForUpdate = true
      try {
        logger.info('Requesting visible installation through electron-updater')
        autoUpdater.quitAndInstall()
      } catch (error) {
        isQuittingForUpdate = false
        throw error
      }
    },
    onState: (snapshot) => {
      updateSnapshot = snapshot
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:message', snapshot)
      }
    },
  })

  logger.info(
    `Updater initialized: current=v${app.getVersion()}, distribution=${updaterController.getSnapshot().distribution}, executable=${process.execPath}`
  )

  autoUpdater.on('download-progress', (progress) => {
    updaterController?.reportDownloadProgress(progress.percent)
  })
  autoUpdater.on('error', (error) => {
    isQuittingForUpdate = false
    const attempt = readUpdateAttempt(attemptFilePath)
    if (attempt?.status === 'launching') {
      try {
        writeUpdateAttempt(attemptFilePath, {
          ...attempt,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          updatedAt: new Date().toISOString(),
        })
      } catch (stateError) {
        logger.error('Failed to persist asynchronous updater error', stateError)
      }
    }
    updaterController?.reportUpdaterError(error)
  })

  let databaseClosedForUpdate = false
  const closeDatabaseForUpdate = () => {
    if (databaseClosedForUpdate) return
    databaseClosedForUpdate = true
    logger.info('Update quit confirmed; closing the database cleanly')
    try {
      const database = getDatabase()
      if (database?.open) database.close()
    } catch (error) {
      logger.warn('Failed to close database cleanly during update quit', error)
    }
  }

  electronAutoUpdater.on('before-quit-for-update', () => {
    isQuittingForUpdate = true
    closeDatabaseForUpdate()
  })
  app.on('before-quit', () => {
    if (isQuittingForUpdate) closeDatabaseForUpdate()
  })

  ipcMain.handle('update:get-state', () => updateSnapshot || updaterController?.getSnapshot())
  ipcMain.handle('update:check', () => updaterController!.checkForUpdates())
  ipcMain.handle('update:download', () => updaterController!.downloadUpdate())
  ipcMain.handle('update:install', () => updaterController!.installUpdate())
  ipcMain.handle('update:open-log', async () => {
    const result = await shell.openPath(path.dirname(logFilePath))
    return result ? { success: false, error: result } : { success: true }
  })

  if (updaterController.getSnapshot().distribution === 'installed') {
    setTimeout(() => {
      updaterController?.checkForUpdates().catch((error) => {
        logger.error('Startup update check failed', error)
      })
    }, 5000)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    icon: getAppIconPath(),
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    backgroundColor: '#121212',
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (isQuittingForUpdate || !hasUnsavedRendererChanges || !mainWindow) return
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      title: '存在未保存修改',
      message: '账号或自定义字段仍有未保存修改。',
      detail: '确定要放弃修改并退出 CredVaultix 吗？',
      buttons: ['继续编辑', '放弃并退出'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    })
    if (choice === 0) {
      event.preventDefault()
      return
    }
    hasUnsavedRendererChanges = false
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

if (hasSingleInstanceLock) {
  app.whenReady().then(async () => {
    if (activeUserDataProfile.shouldMigrateLegacyData) {
      try {
        await migrateLegacyUserDataToCredVaultix()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Error migrating legacy user data:', error)
        dialog.showErrorBox(
          'CredVaultix 数据迁移已中止',
          `${message}\n\n为避免数据丢失，程序不会创建新的空数据库。请保留旧数据目录并检查磁盘权限或数据库完整性。`
        )
        app.quit()
        return
      }
    }

    // The renderer never needs runtime permissions beyond sanitized clipboard writes.
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(permission === 'clipboard-sanitized-write')
    })

    try {
      initDatabase()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Error initializing database:', error)
      dialog.showErrorBox(
        'CredVaultix 数据库启动失败',
        `${message}\n\n程序已停止启动，以避免继续写入异常数据库。迁移前备份仍保存在数据目录中。`
      )
      app.quit()
      return
    }
    registerIpcHandlers()
    createWindow()
    setupAutoUpdater()
  })
}

app.on('window-all-closed', () => {
  if (!isQuittingForUpdate) {
    app.quit()
  }
})

app.on('will-quit', () => {
  try {
    const database = getDatabase()
    if (database?.open) database.close()
  } catch {
    // The database may not have initialized when startup was aborted.
  }
})

function registerIpcHandlers() {
  let db = getDatabase()
  const updateServiceInfoDatabase = registerServiceInfoIpc(db)

  ipcMain.handle('app:getRuntimeDataInfo', (): RuntimeDataInfo => ({
    version: app.getVersion(),
    profile: activeUserDataProfile.kind,
    dataDirectory: app.getPath('userData'),
    databasePath: path.join(app.getPath('userData'), DATABASE_FILE_NAME),
    counts: {
      accounts: (db.prepare('SELECT COUNT(*) AS count FROM accounts').get() as { count: number }).count,
      totpAccounts: (db.prepare('SELECT COUNT(*) AS count FROM totp_accounts').get() as { count: number }).count,
      services: (db.prepare('SELECT COUNT(*) AS count FROM secret_services').get() as { count: number }).count,
    },
  }))
  ipcMain.handle('preferences:get', () => readPreferences(app.getPath('userData')))
  ipcMain.handle('preferences:update', (_event, patch: Record<string, unknown>) =>
    updatePreferences(app.getPath('userData'), patch)
  )
  ipcMain.handle('preferences:reset', () => resetPreferences(app.getPath('userData')))

  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.on('app:setUnsavedChanges', (_event, hasUnsavedChanges: boolean) => {
    hasUnsavedRendererChanges = Boolean(hasUnsavedChanges)
  })
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized())

  // ============ Clipboard ============
  const clipboardGuard = createClipboardGuard(clipboard)
  ipcMain.handle('clipboard:copyText', (_event, value: unknown) => {
    const text = typeof value === 'string' ? value : String(value ?? '')
    const preferences = readPreferences(app.getPath('userData')) as { clipboardAutoClear?: unknown }
    const autoClearMs = preferences.clipboardAutoClear !== false ? CLIPBOARD_AUTO_CLEAR_MS : null
    clipboardGuard.copyText(text, autoClearMs)
    return { success: true, autoClearMs }
  })

  registerAccountIpc({
    getDatabase: () => db,
    getMainWindow: () => mainWindow,
  })

  registerTotpIpc({
    getDatabase: () => db,
    getMainWindow: () => mainWindow,
  })

  // ============ Database Export/Import ============
  ipcMain.handle('db:export', async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出数据库',
      defaultPath: `CredVaultix_backup_${new Date().toISOString().slice(0, 10)}.json`,
      filters: [
        { name: 'JSON 备份', extensions: ['json'] },
        { name: 'SQLite 数据库', extensions: ['db'] }
      ]
    })

    if (result.canceled || !result.filePath) return { success: false }

    if (isSqliteDatabasePath(result.filePath)) {
      await db.backup(result.filePath)
    } else {
      const data = {
        version: SERVICE_INFO_BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        tags: db.prepare('SELECT * FROM tags').all(),
        totpAccounts: db.prepare('SELECT * FROM totp_accounts').all(),
        totpQrImages: (db.prepare(`
          SELECT
            totp_account_id,
            encrypted_data,
            mime_type,
            original_name,
            original_size,
            created_at,
            updated_at
          FROM totp_qr_images
        `).all() as Array<{
          totp_account_id: string
          encrypted_data: Buffer
          mime_type: string
          original_name: string
          original_size: number
          created_at: string
          updated_at: string
        }>).map(({ encrypted_data, ...row }) => ({
          ...row,
          encrypted_data_base64: Buffer.from(encrypted_data).toString('base64'),
        })),
        accounts: db.prepare('SELECT * FROM accounts').all(),
        accountCustomFields: db.prepare('SELECT * FROM account_custom_fields').all(),
        accountTags: db.prepare('SELECT * FROM account_tags').all(),
        ...readServiceInfoBackupData(db),
        preferences: readPreferences(app.getPath('userData')),
      }
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    }

    return { success: true, filePath: result.filePath }
  })

  ipcMain.handle('db:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '导入数据库',
      filters: [
        { name: '备份文件', extensions: ['json', 'db'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) return { success: false }

    const filePath = result.filePaths[0]
    let warning: string | undefined

    if (isSqliteDatabasePath(filePath)) {
      const dbPath = path.join(app.getPath('userData'), DATABASE_FILE_NAME)
      const stagingDirectory = fs.mkdtempSync(path.join(app.getPath('temp'), 'credvaultix-import-'))
      const stagedDbPath = path.join(stagingDirectory, 'candidate.db')
      try {
        const snapshotted = await copySqliteSnapshotIfMissing(filePath, stagedDbPath)
        if (!snapshotted) throw new Error('无法创建待导入数据库的安全快照')
        validateSqliteBackup(stagedDbPath)

        const backup = backupCurrentDatabaseBeforeImport(db)
        db.close()
        try {
          restoreDatabaseFromBackup(stagedDbPath, dbPath)
          initDatabase()
          db = getDatabase()
          updateServiceInfoDatabase(db)
        } catch (importError) {
          try {
            const failedDatabase = getDatabase()
            if (failedDatabase?.open) failedDatabase.close()
          } catch {
            // The imported database may have failed before a connection was assigned.
          }

          try {
            db = recoverDatabaseAfterFailedImport({
              importError,
              backupPath: backup.filePath,
              databasePath: dbPath,
              fileExists: fs.existsSync,
              restoreDatabase: restoreDatabaseFromBackup,
              initializeDatabase: initDatabase,
              activateDatabase: updateServiceInfoDatabase,
            })
          } catch (recoveryError) {
            quitAfterFatalDatabaseRecovery(
              recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError))
            )
          }
          throw importError
        }
      } finally {
        try {
          fs.rmSync(stagingDirectory, { recursive: true, force: true })
        } catch (error) {
          console.warn('Failed to remove SQLite import staging directory:', error)
        }
      }
    } else {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(raw)
      assertValidJsonBackup(data)

      backupCurrentDatabaseBeforeImport(db)

      const importTransaction = db.transaction(() => {
        const legacyServiceAccountLinks = captureLegacyServiceAccountLinks(db, data)

        db.prepare('DELETE FROM tags').run()
        db.prepare('DELETE FROM totp_qr_images').run()
        db.prepare('DELETE FROM totp_accounts').run()
        db.prepare('DELETE FROM account_custom_fields').run()
        db.prepare('DELETE FROM account_tags').run()
        db.prepare('DELETE FROM accounts').run()

        const insertTag = db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)')
        for (const t of data.tags || []) {
          insertTag.run(t.id, t.name, t.color || pickTagColor(String(t.name || '')))
        }

        // Import TOTP accounts
        const insertTotp = db.prepare('INSERT INTO totp_accounts (id, issuer, label, secret, algorithm, digits, period, otp_type, counter, linked_account_id, sort_order, created_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        for (const a of data.totpAccounts || []) {
          insertTotp.run(
            a.id,
            a.issuer,
            a.label,
            encryptIfNeeded(a.secret || ''),
            normalizeOtpAlgorithm(a.algorithm),
            normalizeOtpDigits(a.digits),
            normalizeOtpPeriod(a.period),
            normalizeOtpType(a.otp_type),
            normalizeOtpCounter(a.counter),
            a.linked_account_id || null,
            a.sort_order || 0,
            a.created_at,
            normalizeTotpSource(a.source)
          )
        }

        const insertTotpQrImage = db.prepare(`
          INSERT INTO totp_qr_images (
            totp_account_id,
            encrypted_data,
            mime_type,
            original_name,
            original_size,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        for (const image of data.totpQrImages || []) {
          const plaintext = decryptBuffer(Buffer.from(image.encrypted_data_base64, 'base64'))
          const normalized = prepareTotpQrImage({
            bytes: new Uint8Array(plaintext),
            mimeType: image.mime_type,
            originalName: image.original_name,
          })!
          const timestamp = new Date().toISOString()
          insertTotpQrImage.run(
            image.totp_account_id,
            encryptBuffer(normalized.bytes),
            normalized.mimeType,
            normalized.originalName,
            normalized.bytes.byteLength,
            typeof image.created_at === 'string' ? image.created_at : timestamp,
            typeof image.updated_at === 'string' ? image.updated_at : timestamp
          )
        }

        // Import Accounts
        const insertAccount = db.prepare('INSERT INTO accounts (id, name, platform, username, password, phone, backup_email, totp_secret, notes, is_favorite, is_deleted, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        for (const a of data.accounts || []) {
          insertAccount.run(
            a.id,
            a.name,
            normalizeAccountPlatform(a.platform),
            encryptIfNeeded(a.username || ''),
            encryptIfNeeded(a.password || ''),
            encryptIfNeeded(a.phone || ''),
            encryptIfNeeded(a.backup_email || ''),
            encryptIfNeeded(a.totp_secret || ''),
            a.notes || '',
            a.is_favorite || 0,
            a.is_deleted || 0,
            a.deleted_at || null,
            a.created_at,
            a.updated_at
          )
        }

        // Import Account Custom Fields
        const insertField = db.prepare('INSERT INTO account_custom_fields (id, account_id, field_name, field_value, is_secret, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
        for (const f of data.accountCustomFields || []) {
          const isSecret = f.is_secret ? 1 : 0
          insertField.run(
            f.id,
            f.account_id,
            f.field_name,
            isSecret ? encryptIfNeeded(f.field_value || '') : f.field_value || '',
            isSecret,
            f.sort_order || 0
          )
        }

        const insertAccountTag = db.prepare('INSERT OR IGNORE INTO account_tags (account_id, tag_id) VALUES (?, ?)')
        for (const tag of data.accountTags || []) {
          insertAccountTag.run(tag.account_id, tag.tag_id)
        }

        importServiceInfoBackupData(db, data, encryptIfNeeded)
        restoreLegacyServiceAccountLinks(db, legacyServiceAccountLinks)
      })

      importTransaction()

      const importedPreferences = data.preferences
      if (importedPreferences && typeof importedPreferences === 'object' && !Array.isArray(importedPreferences)) {
        try {
          replacePreferences(app.getPath('userData'), importedPreferences as Record<string, unknown>)
        } catch (error) {
          console.error('Database data imported, but preferences could not be restored:', error)
          warning = '数据库内容已恢复，但界面偏好未能恢复；现有偏好保持不变'
        }
      }
    }

    return { success: true, warning }
  })
}
