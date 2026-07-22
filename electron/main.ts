import { app, autoUpdater as electronAutoUpdater, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import Database from 'better-sqlite3'
import path from 'path'
import { DATABASE_FILE_NAME, initDatabase, getDatabase } from './database'
import { encrypt, decrypt, encryptIfNeeded } from './crypto'
import {
  PROTECTED_TABLES,
  SERVICE_INFO_TABLES,
  assertCountsNotReduced,
  assertFullWalCheckpoint,
  backupDatabaseIfExists,
  getExistingTableCounts,
  type CoreTableCounts,
} from './databaseSafety'
import {
  SERVICE_INFO_BACKUP_VERSION,
  captureLegacyServiceAccountLinks,
  importServiceInfoBackupData,
  readServiceInfoBackupData,
  restoreLegacyServiceAccountLinks,
} from './serviceInfoBackup'
import { readPreferences, resetPreferences, updatePreferences } from './preferencesStore'
import { registerServiceInfoIpc } from './serviceInfoRepository'
import { accountMatchesSearch } from './accountSearch'
import { assertValidJsonBackup } from './backupValidation'
import { normalizeCsvAccountRow } from './csvAccountImport'
import {
  type AccountUpdateData,
  createTotpRecord,
  deleteTotpRecord,
  incrementHotpCounter,
  normalizeAccountPlatform,
  normalizeOtpAlgorithm,
  normalizeOtpCounter,
  normalizeOtpDigits,
  normalizeOtpPeriod,
  normalizeOtpType,
  updateAccountRecord,
  updateTotpRecord,
} from './accountTotpRepository'
import { addTagToAccount, removeTagFromAccount } from './accountTagRepository'
import { addAccountField, deleteAccountField, updateAccountField } from './accountFieldRepository'
import { hardDeleteAccountRecord, moveAccountToTrash, restoreAccountFromTrash } from './accountLifecycleRepository'
import { UpdaterController } from './updaterController'
import { createUpdaterLogger } from './updaterLogger'
import {
  read as readUpdateAttempt,
  reconcile as reconcileUpdateAttempt,
  remove as removeUpdateAttempt,
  write as writeUpdateAttempt,
} from './updaterStateStore'
import type { UpdateSnapshot } from '../shared/update'
import fs from 'fs'
import Papa from 'papaparse'
import { v4 as uuidv4 } from 'uuid'

let mainWindow: BrowserWindow | null = null
const APP_ID = 'com.personal.credvaultix'
const APP_NAME = 'CredVaultix'
const RELEASE_URL = 'https://github.com/zzf-857/CredVaultix/releases/latest'
const LEGACY_DATABASE_FILE_NAME = 'account-manager.db'
const DATA_TABLES = [...PROTECTED_TABLES, ...SERVICE_INFO_TABLES]
const TAG_COLOR_PALETTE = ['#a8c7fa', '#81c995', '#f2b8b5', '#fdd663', '#d7aefb', '#78d9ec', '#fcb68e']
let isQuittingForUpdate = false
let updaterController: UpdaterController | null = null
let updateSnapshot: UpdateSnapshot | null = null
let usesExplicitUserDataDirectory = false
let hasUnsavedRendererChanges = false

app.setName(APP_NAME)

function configureAppIdentity() {
  app.setName(APP_NAME)
  app.setAppUserModelId(APP_ID)
  const userDataArgument = process.argv.find((argument) => argument.startsWith('--user-data-dir='))
  const explicitUserDataPath = userDataArgument?.slice('--user-data-dir='.length).trim()
  usesExplicitUserDataDirectory = Boolean(explicitUserDataPath)
  app.setPath(
    'userData',
    explicitUserDataPath ? path.resolve(explicitUserDataPath) : path.join(app.getPath('appData'), APP_NAME)
  )
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

function pickTagColor(name: string) {
  const seed = Array.from(name).reduce((total, char) => total + char.charCodeAt(0), 0)
  return TAG_COLOR_PALETTE[seed % TAG_COLOR_PALETTE.length]
}

function backupCurrentDatabaseBeforeImport(currentDb: Database.Database) {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, DATABASE_FILE_NAME)

  assertFullWalCheckpoint(currentDb)
  const backup = backupDatabaseIfExists(dbPath, userDataPath, new Date(), 'import')
  if (!backup.created || !backup.filePath || !fs.existsSync(backup.filePath)) {
    throw new Error('导入已中止：无法创建当前数据库的安全备份')
  }

  validateSqliteBackup(backup.filePath, getExistingTableCounts(currentDb, DATA_TABLES))
  return backup
}

function removeDatabaseSidecars(dbPath: string) {
  for (const sidecarPath of [`${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(sidecarPath)) {
      fs.rmSync(sidecarPath, { force: true })
    }
  }
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

function migrateLegacyUserDataToCredVaultix() {
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

  try {
    for (const source of legacySources) {
      if (path.resolve(source.directory) === path.resolve(targetUserDataPath)) {
        continue
      }

      const sourceDbPath = path.join(source.directory, source.databaseFileName)
      if (copyFileIfMissing(sourceDbPath, targetDbPath)) {
        console.log(`Migrated legacy ${source.name} database into ${APP_NAME}`)
      }

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
    }
  } catch (err) {
    console.error('Error migrating legacy user data:', err)
  }
}

function validateSqliteBackup(filePath: string, expectedCounts?: CoreTableCounts) {
  const candidate = new Database(filePath, { readonly: true, fileMustExist: true })
  try {
    const integrity = candidate.pragma('integrity_check', { simple: true })
    if (integrity !== 'ok') {
      throw new Error(`SQLite 完整性检查失败：${String(integrity)}`)
    }

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
  const backup = backupDatabaseIfExists(databasePath, userDataPath, new Date(), 'update')
  if (!backup.created || !backup.filePath || !fs.existsSync(backup.filePath)) {
    throw new Error('无法创建更新前数据库备份，已中止更新安装')
  }
  validateSqliteBackup(backup.filePath, expectedCounts)
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
  app.whenReady().then(() => {
    if (!usesExplicitUserDataDirectory) {
      migrateLegacyUserDataToCredVaultix()
    }

    initDatabase()
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

function registerIpcHandlers() {
  let db = getDatabase()
  const updateServiceInfoDatabase = registerServiceInfoIpc(db)

  ipcMain.handle('preferences:get', () => readPreferences(app.getPath('userData')))
  ipcMain.handle('preferences:update', (_event, patch: Record<string, unknown>) =>
    updatePreferences(app.getPath('userData'), patch)
  )
  ipcMain.handle('preferences:reset', () => resetPreferences(app.getPath('userData')))

  const getTagsForAccount = (accountId: string) => {
    return db.prepare(`
      SELECT t.*
      FROM tags t
      INNER JOIN account_tags at ON at.tag_id = t.id
      WHERE at.account_id = ?
      ORDER BY t.name ASC
    `).all(accountId)
  }

  const getLinkedTotpAccounts = (accountId: string) => {
    return (db.prepare(`
      SELECT *
      FROM totp_accounts
      WHERE linked_account_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(accountId) as any[]).map((totpAccount) => ({
      ...totpAccount,
      secret: decrypt(totpAccount.secret),
    }))
  }

  const hydrateAccountRow = (row: any) => {
    const linkedTotpAccounts = getLinkedTotpAccounts(row.id)
    return {
      ...row,
      platform: normalizeAccountPlatform(row.platform),
      username: decrypt(row.username),
      password: decrypt(row.password),
      phone: decrypt(row.phone),
      backup_email: decrypt(row.backup_email),
      // A single linked 2FA record is authoritative; duplicate legacy rows are surfaced instead of auto-resolved.
      totp_secret: linkedTotpAccounts.length === 1
        ? linkedTotpAccounts[0].secret
        : decrypt(row.totp_secret),
      linked_totp_accounts: linkedTotpAccounts,
      linked_totp_count: linkedTotpAccounts.length,
      tags: getTagsForAccount(row.id),
    }
  }

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

  // ============ Accounts ============
  ipcMain.handle('accounts:getAll', (_event, filters?: { search?: string; favoritesOnly?: boolean; isDeleted?: boolean; platform?: string }) => {
    let query = 'SELECT * FROM accounts'
    const conditions: string[] = []
    const params: any[] = []

    if (filters?.isDeleted) {
      conditions.push('is_deleted = 1')
    } else {
      conditions.push('is_deleted = 0')
    }

    if (filters?.favoritesOnly) {
      conditions.push('is_favorite = 1')
    }
    if (filters?.platform && filters.platform !== 'all') {
      conditions.push('platform = ?')
      params.push(normalizeAccountPlatform(filters.platform))
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }
    query += ' ORDER BY updated_at DESC'

    const rows = db.prepare(query).all(...params) as any[]
    const hydratedRows = rows.map(hydrateAccountRow)
    return filters?.search
      ? hydratedRows.filter((account) => accountMatchesSearch(account, filters.search || ''))
      : hydratedRows
  })

  ipcMain.handle('accounts:getById', (_event, id: string) => {
    const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any
    if (!row) return null
    const hydrated = hydrateAccountRow(row)

    // Get custom fields
    const fields = db.prepare('SELECT * FROM account_custom_fields WHERE account_id = ? ORDER BY sort_order ASC').all(id) as any[]
    hydrated.customFields = fields.map((f: any) => ({
      ...f,
      field_value: f.is_secret ? decrypt(f.field_value) : f.field_value,
    }))
    return hydrated
  })

  ipcMain.handle('accounts:create', (_event, data: { id: string; name: string; platform?: string; username?: string; password?: string; phone?: string; backupEmail?: string; totpSecret?: string; notes?: string }) => {
    const accountName = String(data.name || '').trim()
    if (!accountName) throw new Error('Account name is required')
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO accounts (id, name, platform, username, password, phone, backup_email, totp_secret, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id, accountName, normalizeAccountPlatform(data.platform ?? 'google'),
      encrypt(data.username || ''), encrypt(data.password || ''),
      encrypt(data.phone || ''), encrypt(data.backupEmail || ''),
      encrypt(data.totpSecret || ''), data.notes || '',
      now, now
    )
    return { id: data.id }
  })

  ipcMain.handle('accounts:update', (_event, id: string, data: AccountUpdateData) => {
    return updateAccountRecord(db, id, data, { encrypt })
  })

  ipcMain.handle('accounts:delete', (_event, id: string) => {
    return moveAccountToTrash(db, id)
  })

  ipcMain.handle('accounts:restore', (_event, id: string) => {
    return restoreAccountFromTrash(db, id)
  })

  ipcMain.handle('accounts:hardDelete', (_event, id: string) => {
    return hardDeleteAccountRecord(db, id)
  })

  ipcMain.handle('accounts:importCsv', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '导入 CSV 账号数据',
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { count: 0, invalidTotpCount: 0, skippedRowCount: 0 }
    }
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
    
    // Parse CSV
    const parsed = Papa.parse(raw, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase()
    })

    if (parsed.errors.length && parsed.data.length === 0) {
      return { count: 0, invalidTotpCount: 0, skippedRowCount: 0 }
    }

    let count = 0
    let invalidTotpCount = 0
    let skippedRowCount = 0
    const now = new Date().toISOString()
    const insertAccount = db.prepare('INSERT INTO accounts (id, name, platform, username, password, phone, backup_email, totp_secret, notes, is_favorite, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const insertTotp = db.prepare(`
      INSERT INTO totp_accounts (
        id, issuer, label, secret, algorithm, digits, period, otp_type,
        counter, linked_account_id, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const maxTotpOrder = db.prepare('SELECT MAX(sort_order) as maxOrder FROM totp_accounts').get() as { maxOrder?: number | null } | undefined
    let nextTotpOrder = (maxTotpOrder?.maxOrder || 0) + 1

    db.transaction(() => {
      for (const row of parsed.data as any[]) {
        const normalized = normalizeCsvAccountRow(row)
        if (!normalized) {
          skippedRowCount += 1
          continue
        }

        const id = uuidv4()
        if (normalized.invalidTotpUri) invalidTotpCount += 1
        
        insertAccount.run(
          id, normalized.name,
          normalizeAccountPlatform(normalized.platform),
          encrypt(normalized.username), encrypt(normalized.password),
          encrypt(normalized.phone), encrypt(normalized.backupEmail), encrypt(normalized.totpSecret),
          normalized.notes, 0, 0, now, now
        )

        if (normalized.totpSecret) {
          insertTotp.run(
            uuidv4(),
            normalized.otp?.issuer || normalized.name,
            normalized.otp?.label || normalized.username || normalized.name,
            encrypt(normalized.totpSecret),
            normalized.otp?.algorithm || 'SHA1',
            normalized.otp?.digits || 6,
            normalized.otp?.period || 30,
            normalized.otp?.otpType || 'totp',
            normalized.otp?.counter || 0,
            id,
            nextTotpOrder,
            now
          )
          nextTotpOrder += 1
        }
        count++
      }
    })()

    return { count, invalidTotpCount, skippedRowCount }
  })

  ipcMain.handle('accounts:addTag', (_event, data: { accountId: string; tagName: string; color?: string }) => {
    return addTagToAccount(db, data, { createId: uuidv4, pickColor: pickTagColor })
  })

  ipcMain.handle('accounts:removeTag', (_event, data: { accountId: string; tagId: string }) => {
    return removeTagFromAccount(db, data)
  })

  // ============ Custom Fields ============
  ipcMain.handle('accounts:addField', (_event, data: { id: string; accountId: string; fieldName: string; fieldValue: string; isSecret: boolean }) => {
    return addAccountField(db, data, { encrypt, decrypt })
  })

  ipcMain.handle('accounts:updateField', (_event, id: string, data: { fieldName?: string; fieldValue?: string; isSecret?: boolean }) => {
    return updateAccountField(db, id, data, { encrypt, decrypt })
  })

  ipcMain.handle('accounts:deleteField', (_event, id: string) => {
    return deleteAccountField(db, id)
  })

  // ============ TOTP 2FA ============
  ipcMain.handle('totp:getAll', () => {
    return (db.prepare('SELECT * FROM totp_accounts ORDER BY sort_order ASC, label ASC').all() as any[])
      .map((account) => {
        let linkedAccountState: 'active' | 'trashed' | 'missing' | 'unlinked' = 'unlinked'
        if (account.linked_account_id) {
          if (account.linked_account_id.startsWith('!deleted-')) {
            linkedAccountState = 'missing'
          } else {
            const linkedAccount = db.prepare('SELECT is_deleted FROM accounts WHERE id = ?')
              .get(account.linked_account_id) as { is_deleted?: number } | undefined
            linkedAccountState = linkedAccount
              ? linkedAccount.is_deleted ? 'trashed' : 'active'
              : 'missing'
          }
        }
        return { ...account, secret: decrypt(account.secret), linked_account_state: linkedAccountState }
      })
  })

  ipcMain.handle('totp:create', (_event, data: { id: string; issuer: string; label: string; secret: string; algorithm?: string; digits?: number; period?: number; otpType?: string; counter?: number; linkedAccountId?: string }) => {
    return createTotpRecord(db, data, { encrypt })
  })

  ipcMain.handle('totp:update', (_event, id: string, data: { issuer?: string; label?: string; secret?: string; algorithm?: string; digits?: number; period?: number; otpType?: string; counter?: number }) => {
    return updateTotpRecord(db, id, data, { encrypt })
  })

  ipcMain.handle('totp:delete', (_event, id: string) => {
    return deleteTotpRecord(db, id, { encrypt })
  })

  ipcMain.handle('totp:incrementCounter', (_event, id: string) => {
    return incrementHotpCounter(db, id)
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
        accounts: db.prepare('SELECT * FROM accounts').all(),
        accountCustomFields: db.prepare('SELECT * FROM account_custom_fields').all(),
        accountTags: db.prepare('SELECT * FROM account_tags').all(),
        ...readServiceInfoBackupData(db),
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

    if (isSqliteDatabasePath(filePath)) {
      const dbPath = path.join(app.getPath('userData'), DATABASE_FILE_NAME)
      validateSqliteBackup(filePath)
      const backup = backupCurrentDatabaseBeforeImport(db)
      db.close()
      try {
        removeDatabaseSidecars(dbPath)
        fs.copyFileSync(filePath, dbPath)
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

        if (!backup.filePath || !fs.existsSync(backup.filePath)) {
          throw importError
        }

        try {
          removeDatabaseSidecars(dbPath)
          fs.copyFileSync(backup.filePath, dbPath)
          initDatabase()
          db = getDatabase()
          updateServiceInfoDatabase(db)
        } catch (restoreError) {
          throw new Error(
            `导入失败，且自动恢复原数据库失败：${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
            { cause: importError }
          )
        }
        throw importError
      }
    } else {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(raw)
      assertValidJsonBackup(data)

      backupCurrentDatabaseBeforeImport(db)

      const importTransaction = db.transaction(() => {
        const legacyServiceAccountLinks = captureLegacyServiceAccountLinks(db, data)

        db.prepare('DELETE FROM tags').run()
        db.prepare('DELETE FROM totp_accounts').run()
        db.prepare('DELETE FROM account_custom_fields').run()
        db.prepare('DELETE FROM account_tags').run()
        db.prepare('DELETE FROM accounts').run()

        const insertTag = db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)')
        for (const t of data.tags || []) {
          insertTag.run(t.id, t.name, t.color)
        }

        // Import TOTP accounts
        const insertTotp = db.prepare('INSERT INTO totp_accounts (id, issuer, label, secret, algorithm, digits, period, otp_type, counter, linked_account_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
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
            a.created_at
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
    }

    return { success: true }
  })
}
