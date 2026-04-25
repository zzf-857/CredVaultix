import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { initDatabase, getDatabase } from './database'
import { encrypt, decrypt } from './crypto'
import fs from 'fs'
import Papa from 'papaparse'
import { v4 as uuidv4 } from 'uuid'

let mainWindow: BrowserWindow | null = null
const TAG_COLOR_PALETTE = ['#a8c7fa', '#81c995', '#f2b8b5', '#fdd663', '#d7aefb', '#78d9ec', '#fcb68e']

function normalizeAccountPlatform(value?: string | null) {
  if (value === 'google' || value === 'microsoft' || value === 'other') {
    return value
  }

  return 'other'
}

function pickTagColor(name: string) {
  const seed = Array.from(name).reduce((total, char) => total + char.charCodeAt(0), 0)
  return TAG_COLOR_PALETTE[seed % TAG_COLOR_PALETTE.length]
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#121212',
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  app.name = 'AccountManager'

  // Auto-migrate old prompt-manager database to new AccountManager folder
  try {
    const oldUserDataPath = path.join(app.getPath('appData'), 'prompt-manager')
    const newUserDataPath = app.getPath('userData') // Resolves to AccountManager now
    
    if (fs.existsSync(oldUserDataPath) && oldUserDataPath !== newUserDataPath) {
      const oldDbPath = path.join(oldUserDataPath, 'prompt-manager.db')
      const newDbPath = path.join(newUserDataPath, 'account-manager.db')
      
      if (fs.existsSync(oldDbPath) && !fs.existsSync(newDbPath)) {
        if (!fs.existsSync(newUserDataPath)) {
          fs.mkdirSync(newUserDataPath, { recursive: true })
        }
        fs.copyFileSync(oldDbPath, newDbPath)
        console.log('Successfully migrated database from prompt-manager to AccountManager')
      }
    }
  } catch (e) {
    console.error('Error migrating old database:', e)
  }

  initDatabase()
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

function registerIpcHandlers() {
  let db = getDatabase()

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
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized())

  // ============ Prompts ============
  ipcMain.handle('prompts:getAll', (_event, filters?: { folderId?: string; tagId?: string; search?: string; favoritesOnly?: boolean }) => {
    let query = `
      SELECT p.*, GROUP_CONCAT(pt.tag_id) as tag_ids
      FROM prompts p
      LEFT JOIN prompt_tags pt ON p.id = pt.prompt_id
    `
    const conditions: string[] = []
    const params: any[] = []

    if (filters?.folderId) {
      conditions.push('p.folder_id = ?')
      params.push(filters.folderId)
    }
    if (filters?.tagId) {
      conditions.push('p.id IN (SELECT prompt_id FROM prompt_tags WHERE tag_id = ?)')
      params.push(filters.tagId)
    }
    if (filters?.search) {
      conditions.push('(p.title LIKE ? OR p.content LIKE ?)')
      params.push(`%${filters.search}%`, `%${filters.search}%`)
    }
    if (filters?.favoritesOnly) {
      conditions.push('p.is_favorite = 1')
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }
    query += ' GROUP BY p.id ORDER BY p.updated_at DESC'

    return db.prepare(query).all(...params)
  })

  ipcMain.handle('prompts:getById', (_event, id: string) => {
    const prompt = db.prepare(`
      SELECT p.*, GROUP_CONCAT(pt.tag_id) as tag_ids
      FROM prompts p
      LEFT JOIN prompt_tags pt ON p.id = pt.prompt_id
      WHERE p.id = ?
      GROUP BY p.id
    `).get(id)
    return prompt
  })

  ipcMain.handle('prompts:create', (_event, data: { id: string; title: string; content: string; folderId?: string; tags?: string[] }) => {
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO prompts (id, title, content, folder_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.id, data.title, data.content, data.folderId || null, now, now)

    if (data.tags && data.tags.length > 0) {
      const insertTag = db.prepare('INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)')
      for (const tagId of data.tags) {
        insertTag.run(data.id, tagId)
      }
    }
    return { id: data.id }
  })

  ipcMain.handle('prompts:update', (_event, id: string, data: { title?: string; content?: string; folderId?: string | null; tags?: string[]; isFavorite?: number }) => {
    const now = new Date().toISOString()
    const updates: string[] = ['updated_at = ?']
    const params: any[] = [now]

    if (data.title !== undefined) { updates.push('title = ?'); params.push(data.title) }
    if (data.content !== undefined) { updates.push('content = ?'); params.push(data.content) }
    if (data.folderId !== undefined) { updates.push('folder_id = ?'); params.push(data.folderId) }
    if (data.isFavorite !== undefined) { updates.push('is_favorite = ?'); params.push(data.isFavorite) }

    params.push(id)
    db.prepare(`UPDATE prompts SET ${updates.join(', ')} WHERE id = ?`).run(...params)

    if (data.tags !== undefined) {
      db.prepare('DELETE FROM prompt_tags WHERE prompt_id = ?').run(id)
      const insertTag = db.prepare('INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)')
      for (const tagId of data.tags) {
        insertTag.run(id, tagId)
      }
    }
    return { success: true }
  })

  ipcMain.handle('prompts:delete', (_event, id: string) => {
    db.prepare('DELETE FROM prompts WHERE id = ?').run(id)
    return { success: true }
  })

  // ============ Folders ============
  ipcMain.handle('folders:getAll', () => {
    return db.prepare('SELECT * FROM folders ORDER BY sort_order ASC, name ASC').all()
  })

  ipcMain.handle('folders:create', (_event, data: { id: string; name: string; parentId?: string }) => {
    const now = new Date().toISOString()
    db.prepare('INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)').run(data.id, data.name, data.parentId || null, now)
    return { id: data.id }
  })

  ipcMain.handle('folders:update', (_event, id: string, data: { name?: string; parentId?: string | null; sortOrder?: number }) => {
    const updates: string[] = []
    const params: any[] = []
    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name) }
    if (data.parentId !== undefined) { updates.push('parent_id = ?'); params.push(data.parentId) }
    if (data.sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(data.sortOrder) }
    params.push(id)
    db.prepare(`UPDATE folders SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    return { success: true }
  })

  ipcMain.handle('folders:delete', (_event, id: string) => {
    db.prepare('UPDATE prompts SET folder_id = NULL WHERE folder_id = ?').run(id)
    db.prepare('DELETE FROM folders WHERE id = ?').run(id)
    return { success: true }
  })

  // ============ Tags ============
  ipcMain.handle('tags:getAll', () => {
    return db.prepare('SELECT * FROM tags ORDER BY name ASC').all()
  })

  ipcMain.handle('tags:create', (_event, data: { id: string; name: string; color: string }) => {
    db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(data.id, data.name, data.color)
    return { id: data.id }
  })

  ipcMain.handle('tags:update', (_event, id: string, data: { name?: string; color?: string }) => {
    const updates: string[] = []
    const params: any[] = []
    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name) }
    if (data.color !== undefined) { updates.push('color = ?'); params.push(data.color) }
    params.push(id)
    db.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    return { success: true }
  })

  ipcMain.handle('tags:delete', (_event, id: string) => {
    db.prepare('DELETE FROM prompt_tags WHERE tag_id = ?').run(id)
    db.prepare('DELETE FROM account_tags WHERE tag_id = ?').run(id)
    db.prepare('DELETE FROM tags WHERE id = ?').run(id)
    return { success: true }
  })

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

    if (filters?.search) {
      conditions.push('(name LIKE ? OR username LIKE ? OR notes LIKE ?)')
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`)
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
    return rows.map(hydrateAccountRow)
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
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO accounts (id, name, platform, username, password, phone, backup_email, totp_secret, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id, data.name, normalizeAccountPlatform(data.platform ?? 'google'),
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

    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name) }
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
        db.prepare('UPDATE totp_accounts SET secret = ? WHERE linked_account_id = ?').run(data.totpSecret.trim(), id)
      }
    } else if (data.name !== undefined) {
      // Name changed → update linked totp issuer/label
      db.prepare('UPDATE totp_accounts SET issuer = ?, label = ? WHERE linked_account_id = ?').run(data.name, data.name, id)
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
    db.prepare('DELETE FROM account_custom_fields WHERE account_id = ?').run(id)
    db.prepare('DELETE FROM account_tags WHERE account_id = ?').run(id)
    db.prepare("UPDATE totp_accounts SET linked_account_id = ? WHERE linked_account_id = ?").run('!deleted-' + id, id)
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('accounts:importCsv', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '导入 CSV 账号数据',
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) return { count: 0 }
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
    
    // Parse CSV
    const parsed = Papa.parse(raw, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase()
    })

    if (parsed.errors.length && parsed.data.length === 0) return { count: 0 }

    let count = 0
    const now = new Date().toISOString()
    const insertAccount = db.prepare('INSERT INTO accounts (id, name, platform, username, password, phone, backup_email, totp_secret, notes, is_favorite, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')

    db.transaction(() => {
      for (const row of parsed.data as any[]) {
        const id = uuidv4()
        const name = row.name || row.url || row.title || '未命名账号'
        const username = row.username || row.login || row.email || ''
        const password = row.password || ''
        const notes = row.note || row.notes || ''
        const totp = row.totp || row.authenticator || ''
        
        insertAccount.run(
          id, name,
          'other',
          encrypt(username), encrypt(password),
          encrypt(''), encrypt(''), encrypt(totp),
          notes, 0, 0, now, now
        )
        count++
      }
    })()

    return { count }
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
    const updates: string[] = []
    const params: any[] = []
    if (data.fieldName !== undefined) { updates.push('field_name = ?'); params.push(data.fieldName) }
    if (data.fieldValue !== undefined) {
      const isSecret = data.isSecret !== undefined ? data.isSecret : false
      updates.push('field_value = ?'); params.push(isSecret ? encrypt(data.fieldValue) : data.fieldValue)
    }
    if (data.isSecret !== undefined) { updates.push('is_secret = ?'); params.push(data.isSecret ? 1 : 0) }
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
    return db.prepare('SELECT * FROM totp_accounts ORDER BY sort_order ASC, label ASC').all()
  })

  ipcMain.handle('totp:create', (_event, data: { id: string; issuer: string; label: string; secret: string; otpType?: string; linkedAccountId?: string }) => {
    const now = new Date().toISOString()
    // Find the next sort order
    const row = db.prepare('SELECT MAX(sort_order) as maxOrder FROM totp_accounts').get() as any
    const nextOrder = (row?.maxOrder || 0) + 1

    db.prepare(`
      INSERT INTO totp_accounts (id, issuer, label, secret, algorithm, digits, period, otp_type, counter, linked_account_id, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id, data.issuer, data.label, data.secret,
      'SHA1', 6, 30, data.otpType || 'totp', 0, data.linkedAccountId || null,
      nextOrder, now
    )
    return { id: data.id }
  })

  ipcMain.handle('totp:update', (_event, id: string, data: { issuer?: string; label?: string; secret?: string }) => {
    const updates: string[] = []
    const params: any[] = []
    if (data.issuer !== undefined) { updates.push('issuer = ?'); params.push(data.issuer) }
    if (data.label !== undefined) { updates.push('label = ?'); params.push(data.label) }
    if (data.secret !== undefined) { updates.push('secret = ?'); params.push(data.secret) }
    if (updates.length === 0) return { success: true }
    params.push(id)
    db.prepare(`UPDATE totp_accounts SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    return { success: true }
  })

  ipcMain.handle('totp:delete', (_event, id: string) => {
    db.prepare('DELETE FROM totp_accounts WHERE id = ?').run(id)
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
      defaultPath: `AccountManager_backup_${new Date().toISOString().slice(0, 10)}.json`,
      filters: [
        { name: 'JSON 备份', extensions: ['json'] },
        { name: 'SQLite 数据库', extensions: ['db'] }
      ]
    })

    if (result.canceled || !result.filePath) return { success: false }

    if (result.filePath.endsWith('.db')) {
      const dbPath = path.join(app.getPath('userData'), 'account-manager.db')
      fs.copyFileSync(dbPath, result.filePath)
    } else {
      const data = {
        version: 3,
        exportedAt: new Date().toISOString(),
        prompts: db.prepare('SELECT * FROM prompts').all(),
        folders: db.prepare('SELECT * FROM folders').all(),
        tags: db.prepare('SELECT * FROM tags').all(),
        promptTags: db.prepare('SELECT * FROM prompt_tags').all(),
        totpAccounts: db.prepare('SELECT * FROM totp_accounts').all(),
        accounts: db.prepare('SELECT * FROM accounts').all(),
        accountCustomFields: db.prepare('SELECT * FROM account_custom_fields').all(),
        accountTags: db.prepare('SELECT * FROM account_tags').all(),
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

    if (filePath.endsWith('.db')) {
      const dbPath = path.join(app.getPath('userData'), 'account-manager.db')
      db.close()
      fs.copyFileSync(filePath, dbPath)
      initDatabase()
      db = getDatabase()
    } else {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(raw)

      const importTransaction = db.transaction(() => {
        db.prepare('DELETE FROM prompt_tags').run()
        db.prepare('DELETE FROM prompts').run()
        db.prepare('DELETE FROM tags').run()
        db.prepare('DELETE FROM folders').run()
        db.prepare('DELETE FROM totp_accounts').run()
        db.prepare('DELETE FROM account_custom_fields').run()
        db.prepare('DELETE FROM account_tags').run()
        db.prepare('DELETE FROM accounts').run()

        const insertFolder = db.prepare('INSERT INTO folders (id, name, parent_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?)')
        for (const f of data.folders || []) {
          insertFolder.run(f.id, f.name, f.parent_id, f.sort_order || 0, f.created_at)
        }

        const insertTag = db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)')
        for (const t of data.tags || []) {
          insertTag.run(t.id, t.name, t.color)
        }

        const insertPrompt = db.prepare('INSERT INTO prompts (id, title, content, folder_id, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        for (const p of data.prompts || []) {
          insertPrompt.run(p.id, p.title, p.content, p.folder_id, p.is_favorite || 0, p.created_at, p.updated_at)
        }

        const insertPT = db.prepare('INSERT INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)')
        for (const pt of data.promptTags || []) {
          insertPT.run(pt.prompt_id, pt.tag_id)
        }

        // Import TOTP accounts
        const insertTotp = db.prepare('INSERT INTO totp_accounts (id, issuer, label, secret, algorithm, digits, period, otp_type, counter, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        for (const a of data.totpAccounts || []) {
          insertTotp.run(a.id, a.issuer, a.label, a.secret, a.algorithm || 'SHA1', a.digits || 6, a.period || 30, a.otp_type || 'totp', a.counter || 0, a.sort_order || 0, a.created_at)
        }

        // Import Accounts
        const insertAccount = db.prepare('INSERT INTO accounts (id, name, platform, username, password, phone, backup_email, totp_secret, notes, folder_id, is_favorite, is_deleted, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        for (const a of data.accounts || []) {
          insertAccount.run(
            a.id,
            a.name,
            normalizeAccountPlatform(a.platform),
            a.username || '',
            a.password || '',
            a.phone || '',
            a.backup_email || '',
            a.totp_secret || '',
            a.notes || '',
            a.folder_id,
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
          insertField.run(f.id, f.account_id, f.field_name, f.field_value || '', f.is_secret || 0, f.sort_order || 0)
        }

        const insertAccountTag = db.prepare('INSERT OR IGNORE INTO account_tags (account_id, tag_id) VALUES (?, ?)')
        for (const tag of data.accountTags || []) {
          insertAccountTag.run(tag.account_id, tag.tag_id)
        }
      })

      importTransaction()
    }

    return { success: true }
  })
}
