import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import Database from 'better-sqlite3'
import { spawn } from 'child_process'
import path from 'path'
import { DATABASE_FILE_NAME, initDatabase, getDatabase } from './database'
import { encrypt, decrypt, encryptIfNeeded } from './crypto'
import { backupDatabaseIfExists } from './databaseSafety'
import {
  SERVICE_INFO_BACKUP_VERSION,
  importServiceInfoBackupData,
  readServiceInfoBackupData,
} from './serviceInfoBackup'
import { readPreferences, resetPreferences, updatePreferences } from './preferencesStore'
import { registerServiceInfoIpc } from './serviceInfoRepository'
import { accountMatchesSearch } from './accountSearch'
import { assertValidJsonBackup } from './backupValidation'
import { normalizeCsvAccountRow } from './csvAccountImport'
import fs from 'fs'
import Papa from 'papaparse'
import { v4 as uuidv4 } from 'uuid'

let mainWindow: BrowserWindow | null = null
const APP_ID = 'com.personal.credvaultix'
const APP_NAME = 'CredVaultix'
const LEGACY_DATABASE_FILE_NAME = 'account-manager.db'
const TAG_COLOR_PALETTE = ['#a8c7fa', '#81c995', '#f2b8b5', '#fdd663', '#d7aefb', '#78d9ec', '#fcb68e']
let isQuittingForUpdate = false
let downloadedInstallerPath: string | null = null
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

function normalizeAccountPlatform(value?: string | null) {
  if (value === 'google' || value === 'microsoft' || value === 'other') {
    return value
  }

  return 'other'
}

function normalizeOtpAlgorithm(value?: string | null) {
  const algorithm = String(value || 'SHA1').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return ['SHA1', 'SHA256', 'SHA512'].includes(algorithm) ? algorithm : 'SHA1'
}

function normalizeOtpDigits(value?: number | null) {
  const digits = Number(value)
  return Number.isInteger(digits) && digits >= 6 && digits <= 10 ? digits : 6
}

function normalizeOtpPeriod(value?: number | null) {
  const period = Number(value)
  return Number.isInteger(period) && period >= 5 && period <= 300 ? period : 30
}

function normalizeOtpType(value?: string | null) {
  return String(value || '').toLowerCase() === 'hotp' ? 'hotp' : 'totp'
}

function normalizeOtpCounter(value?: number | null) {
  const counter = Number(value)
  return Number.isSafeInteger(counter) && counter >= 0 ? counter : 0
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

  try {
    currentDb.pragma('wal_checkpoint(FULL)')
  } catch (error) {
    console.warn('Failed to checkpoint database before import backup:', error)
  }

  return backupDatabaseIfExists(dbPath, userDataPath)
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

function validateSqliteBackup(filePath: string) {
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
  } finally {
    candidate.close()
  }
}

function getDownloadedInstallerPath() {
  const updater = autoUpdater as typeof autoUpdater & {
    installerPath?: string | null
    downloadedUpdateHelper?: { file?: string | null } | null
  }

  return downloadedInstallerPath ?? updater.installerPath ?? updater.downloadedUpdateHelper?.file ?? null
}

function closeDatabaseForUpdateInstall() {
  try {
    const database = getDatabase()
    if (!database || !database.open) return

    try {
      database.pragma('wal_checkpoint(FULL)')
    } catch (error) {
      console.warn('Failed to checkpoint database before update install:', error)
    }

    database.close()
  } catch (error) {
    console.warn('Failed to close database before update install:', error)
  }
}

function quoteCmdArg(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function launchDownloadedInstallerAfterExit(installerPath: string) {
  const installDirectory = path.dirname(process.execPath)
  const installerArgs = ['--updated', '/S', '/currentuser', `/D=${installDirectory}`]
  const command = [
    'ping 127.0.0.1 -n 4 > nul',
    [installerPath, ...installerArgs].map(quoteCmdArg).join(' '),
  ].join(' & ')

  const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })

  child.unref()
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE)

  const sendUpdateMessage = (status: string, payload: Record<string, unknown> = {}) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:message', { status, isPortable, ...payload })
    }
  }

  autoUpdater.on('checking-for-update', () => {
    sendUpdateMessage('checking')
  })

  autoUpdater.on('update-available', (info) => {
    downloadedInstallerPath = null
    sendUpdateMessage('available', { version: info.version, info })
  })

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateMessage('latest', { version: info.version, info })
  })

  autoUpdater.on('error', (err) => {
    sendUpdateMessage('error', { error: err.message || String(err) })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateMessage('downloading', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateMessage('downloaded', { version: info.version, info })
  })

  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('update:check', async () => {
    if (isPortable) {
      sendUpdateMessage('portable')
      return { success: false, isPortable: true, status: 'portable' }
    }
    if (!app.isPackaged) {
      return { success: false, error: '开发环境跳过更新检查' }
    }

    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, result }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle('update:download', async () => {
    if (isPortable) {
      sendUpdateMessage('portable')
      return { success: false, isPortable: true, status: 'portable' }
    }
    if (!app.isPackaged) {
      return { success: false, error: '开发环境跳过更新下载' }
    }

    try {
      const downloadedFiles = await autoUpdater.downloadUpdate()
      downloadedInstallerPath =
        downloadedFiles.find((filePath) => filePath.endsWith('.exe')) ??
        downloadedFiles[0] ??
        getDownloadedInstallerPath()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle('update:quit-and-install', async () => {
    if (isPortable || !app.isPackaged) {
      return false
    }

    const installerPath = getDownloadedInstallerPath()
    if (!installerPath || !fs.existsSync(installerPath)) {
      sendUpdateMessage('error', { error: '更新包尚未下载完成，请先下载更新包' })
      return false
    }

    try {
      isQuittingForUpdate = true
      sendUpdateMessage('installing')
      closeDatabaseForUpdateInstall()

      for (const window of BrowserWindow.getAllWindows()) {
        window.removeAllListeners('close')
        window.destroy()
      }
      mainWindow = null

      launchDownloadedInstallerAfterExit(installerPath)
      app.quit()
      return true
    } catch (err: any) {
      isQuittingForUpdate = false
      sendUpdateMessage('error', { error: err.message || String(err) })
      return false
    }
  })

  if (app.isPackaged && !isPortable) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('[AutoUpdate] Startup check failed:', err)
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

  const hydrateAccountRow = (row: any) => ({
    ...row,
    platform: normalizeAccountPlatform(row.platform),
    username: decrypt(row.username),
    password: decrypt(row.password),
    phone: decrypt(row.phone),
    backup_email: decrypt(row.backup_email),
    totp_secret: decrypt(row.totp_secret),
    tags: getTagsForAccount(row.id),
  })

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

  ipcMain.handle('accounts:update', (_event, id: string, data: { name?: string; platform?: string; username?: string; password?: string; phone?: string; backupEmail?: string; totpSecret?: string; notes?: string; isFavorite?: number }) => {
    const now = new Date().toISOString()
    const updates: string[] = ['updated_at = ?']
    const params: any[] = [now]

    if (data.name !== undefined) {
      const accountName = data.name.trim()
      if (!accountName) throw new Error('Account name is required')
      updates.push('name = ?')
      params.push(accountName)
    }
    if (data.platform !== undefined) { updates.push('platform = ?'); params.push(normalizeAccountPlatform(data.platform)) }
    if (data.username !== undefined) { updates.push('username = ?'); params.push(encrypt(data.username)) }
    if (data.password !== undefined) { updates.push('password = ?'); params.push(encrypt(data.password)) }
    if (data.phone !== undefined) { updates.push('phone = ?'); params.push(encrypt(data.phone)) }
    if (data.backupEmail !== undefined) { updates.push('backup_email = ?'); params.push(encrypt(data.backupEmail)) }
    if (data.totpSecret !== undefined) { updates.push('totp_secret = ?'); params.push(encrypt(data.totpSecret)) }
    if (data.notes !== undefined) { updates.push('notes = ?'); params.push(data.notes) }
    if (data.isFavorite !== undefined) { updates.push('is_favorite = ?'); params.push(data.isFavorite) }

    params.push(id)
    db.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`).run(...params)

    // Auto-sync to 2FA when totpSecret changes
    if (data.totpSecret !== undefined) {
      if (!data.totpSecret.trim()) {
        // Secret cleared → remove linked totp entry
        db.prepare('DELETE FROM totp_accounts WHERE linked_account_id = ?').run(id)
      } else {
        // Update linked totp secret if it exists
        db.prepare('UPDATE totp_accounts SET secret = ? WHERE linked_account_id = ?').run(encrypt(data.totpSecret.trim()), id)
      }
    }
    if (data.name !== undefined) {
      db.prepare('UPDATE totp_accounts SET issuer = ? WHERE linked_account_id = ?').run(data.name.trim(), id)
    }
    if (data.username !== undefined) {
      const fallbackLabel = data.name?.trim()
        || (db.prepare('SELECT name FROM accounts WHERE id = ?').get(id) as { name?: string } | undefined)?.name
        || ''
      db.prepare('UPDATE totp_accounts SET label = ? WHERE linked_account_id = ?')
        .run(data.username.trim() || fallbackLabel, id)
    }

    return { success: true }
  })

  ipcMain.handle('accounts:delete', (_event, id: string) => {
    const now = new Date().toISOString()
    db.prepare('UPDATE accounts SET is_deleted = 1, deleted_at = ? WHERE id = ?').run(now, id)
    return { success: true }
  })

  ipcMain.handle('accounts:restore', (_event, id: string) => {
    db.prepare('UPDATE accounts SET is_deleted = 0, deleted_at = NULL WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('accounts:hardDelete', (_event, id: string) => {
    const account = db.prepare('SELECT is_deleted FROM accounts WHERE id = ?').get(id) as { is_deleted?: number } | undefined
    if (!account || !account.is_deleted) return { success: false }

    db.transaction(() => {
      db.prepare('DELETE FROM account_custom_fields WHERE account_id = ?').run(id)
      db.prepare('DELETE FROM account_tags WHERE account_id = ?').run(id)
      db.prepare('UPDATE totp_accounts SET linked_account_id = ? WHERE linked_account_id = ?').run(`!deleted-${id}`, id)
      db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
    })()
    return { success: true }
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
    const tagName = data.tagName.trim()
    if (!tagName) {
      throw new Error('Tag name is required')
    }

    let tag = db.prepare('SELECT * FROM tags WHERE lower(name) = lower(?)').get(tagName) as any
    if (!tag) {
      const tagId = uuidv4()
      const color = data.color || pickTagColor(tagName)
      db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(tagId, tagName, color)
      tag = { id: tagId, name: tagName, color }
    }

    db.prepare('INSERT OR IGNORE INTO account_tags (account_id, tag_id) VALUES (?, ?)').run(data.accountId, tag.id)
    return { tagId: tag.id }
  })

  ipcMain.handle('accounts:removeTag', (_event, data: { accountId: string; tagId: string }) => {
    db.prepare('DELETE FROM account_tags WHERE account_id = ? AND tag_id = ?').run(data.accountId, data.tagId)
    return { success: true }
  })

  // ============ Custom Fields ============
  ipcMain.handle('accounts:addField', (_event, data: { id: string; accountId: string; fieldName: string; fieldValue: string; isSecret: boolean }) => {
    const value = data.isSecret ? encrypt(data.fieldValue) : data.fieldValue
    db.prepare('INSERT INTO account_custom_fields (id, account_id, field_name, field_value, is_secret) VALUES (?, ?, ?, ?, ?)').run(data.id, data.accountId, data.fieldName, value, data.isSecret ? 1 : 0)
    return { id: data.id }
  })

  ipcMain.handle('accounts:updateField', (_event, id: string, data: { fieldName?: string; fieldValue?: string; isSecret?: boolean }) => {
    const current = db
      .prepare('SELECT field_value, is_secret FROM account_custom_fields WHERE id = ?')
      .get(id) as { field_value: string; is_secret: number } | undefined
    if (!current) return { success: true }

    const currentIsSecret = Boolean(current.is_secret)
    const nextIsSecret = data.isSecret !== undefined ? Boolean(data.isSecret) : currentIsSecret
    const updates: string[] = []
    const params: any[] = []
    if (data.fieldName !== undefined) { updates.push('field_name = ?'); params.push(data.fieldName) }
    if (data.fieldValue !== undefined || data.isSecret !== undefined) {
      const plainValue = data.fieldValue !== undefined
        ? data.fieldValue
        : currentIsSecret
          ? decrypt(current.field_value)
          : current.field_value
      updates.push('field_value = ?')
      params.push(nextIsSecret ? encrypt(plainValue) : plainValue)
    }
    if (data.isSecret !== undefined) { updates.push('is_secret = ?'); params.push(nextIsSecret ? 1 : 0) }
    if (updates.length === 0) return { success: true }
    params.push(id)
    db.prepare(`UPDATE account_custom_fields SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    return { success: true }
  })

  ipcMain.handle('accounts:deleteField', (_event, id: string) => {
    db.prepare('DELETE FROM account_custom_fields WHERE id = ?').run(id)
    return { success: true }
  })

  // ============ TOTP 2FA ============
  ipcMain.handle('totp:getAll', () => {
    return (db.prepare('SELECT * FROM totp_accounts ORDER BY sort_order ASC, label ASC').all() as any[])
      .map((account) => ({ ...account, secret: decrypt(account.secret) }))
  })

  ipcMain.handle('totp:create', (_event, data: { id: string; issuer: string; label: string; secret: string; algorithm?: string; digits?: number; period?: number; otpType?: string; counter?: number; linkedAccountId?: string }) => {
    const now = new Date().toISOString()
    // Find the next sort order
    const row = db.prepare('SELECT MAX(sort_order) as maxOrder FROM totp_accounts').get() as any
    const nextOrder = (row?.maxOrder || 0) + 1

    db.prepare(`
      INSERT INTO totp_accounts (id, issuer, label, secret, algorithm, digits, period, otp_type, counter, linked_account_id, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id, data.issuer, data.label, encrypt(data.secret),
      normalizeOtpAlgorithm(data.algorithm), normalizeOtpDigits(data.digits), normalizeOtpPeriod(data.period),
      normalizeOtpType(data.otpType), normalizeOtpCounter(data.counter), data.linkedAccountId || null,
      nextOrder, now
    )
    return { id: data.id }
  })

  ipcMain.handle('totp:update', (_event, id: string, data: { issuer?: string; label?: string; secret?: string; algorithm?: string; digits?: number; period?: number; otpType?: string; counter?: number }) => {
    const updates: string[] = []
    const params: any[] = []
    if (data.issuer !== undefined) { updates.push('issuer = ?'); params.push(data.issuer) }
    if (data.label !== undefined) { updates.push('label = ?'); params.push(data.label) }
    if (data.secret !== undefined) { updates.push('secret = ?'); params.push(encrypt(data.secret)) }
    if (data.algorithm !== undefined) { updates.push('algorithm = ?'); params.push(normalizeOtpAlgorithm(data.algorithm)) }
    if (data.digits !== undefined) { updates.push('digits = ?'); params.push(normalizeOtpDigits(data.digits)) }
    if (data.period !== undefined) { updates.push('period = ?'); params.push(normalizeOtpPeriod(data.period)) }
    if (data.otpType !== undefined) { updates.push('otp_type = ?'); params.push(normalizeOtpType(data.otpType)) }
    if (data.counter !== undefined) { updates.push('counter = ?'); params.push(normalizeOtpCounter(data.counter)) }
    if (updates.length === 0) return { success: true }
    params.push(id)
    db.prepare(`UPDATE totp_accounts SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    return { success: true }
  })

  ipcMain.handle('totp:delete', (_event, id: string) => {
    const current = db.prepare('SELECT linked_account_id FROM totp_accounts WHERE id = ?')
      .get(id) as { linked_account_id?: string | null } | undefined
    db.transaction(() => {
      db.prepare('DELETE FROM totp_accounts WHERE id = ?').run(id)
      if (current?.linked_account_id && !current.linked_account_id.startsWith('!deleted-')) {
        db.prepare('UPDATE accounts SET totp_secret = ?, updated_at = ? WHERE id = ?')
          .run('', new Date().toISOString(), current.linked_account_id)
      }
    })()
    return { success: true }
  })

  ipcMain.handle('totp:incrementCounter', (_event, id: string) => {
    db.prepare('UPDATE totp_accounts SET counter = counter + 1 WHERE id = ?').run(id)
    const row = db.prepare('SELECT counter FROM totp_accounts WHERE id = ?').get(id) as any
    return { counter: row?.counter || 0 }
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
      })

      importTransaction()
    }

    return { success: true }
  })
}
