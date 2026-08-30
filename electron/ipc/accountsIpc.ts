import type Database from 'better-sqlite3'
import { dialog, ipcMain, type BrowserWindow, type OpenDialogOptions } from 'electron'
import fs from 'fs'
import Papa from 'papaparse'
import { v4 as uuidv4 } from 'uuid'
import { pickTagColor } from '../../shared/tagColors'
import { accountMatchesSearch } from '../accountSearch'
import { addAccountField, deleteAccountField, updateAccountField } from '../accountFieldRepository'
import { getLinkedTotpByAccountIds, getTagsByAccountIds } from '../accountHydration'
import { hardDeleteAccountRecord, moveAccountToTrash, restoreAccountFromTrash } from '../accountLifecycleRepository'
import { addTagToAccount, deleteTag, getAccountTags, removeTagFromAccount, updateTags } from '../accountTagRepository'
import {
  normalizeAccountPlatform,
  updateAccountRecord,
  type AccountUpdateData,
} from '../accountTotpRepository'
import { decrypt, encrypt } from '../crypto'
import { normalizeCsvAccountRow } from '../csvAccountImport'

interface AccountFilters {
  search?: string
  favoritesOnly?: boolean
  isDeleted?: boolean
  platform?: string
}

interface RegisterAccountIpcOptions {
  getDatabase: () => Database.Database
  getMainWindow: () => BrowserWindow | null
}

function hydrateAccountRows(db: Database.Database, rows: any[]) {
  const accountIds = rows.map((row) => row.id)
  const tagsByAccount = getTagsByAccountIds(db, accountIds)
  const linkedTotpByAccount = getLinkedTotpByAccountIds(db, accountIds, { decrypt })

  return rows.map((row) => {
    const linkedTotpAccounts = linkedTotpByAccount.get(row.id) || []
    return {
      ...row,
      platform: normalizeAccountPlatform(row.platform),
      username: decrypt(row.username),
      password: decrypt(row.password),
      phone: decrypt(row.phone),
      backup_email: decrypt(row.backup_email),
      totp_secret: linkedTotpAccounts.length === 1
        ? linkedTotpAccounts[0].secret
        : decrypt(row.totp_secret),
      linked_totp_accounts: linkedTotpAccounts,
      linked_totp_count: linkedTotpAccounts.length,
      tags: tagsByAccount.get(row.id) || [],
    }
  })
}

async function chooseCsvFile(mainWindow: BrowserWindow | null) {
  const options: OpenDialogOptions = {
    title: '导入 CSV 账号数据',
    filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
    properties: ['openFile'],
  }
  return mainWindow
    ? dialog.showOpenDialog(mainWindow, options)
    : dialog.showOpenDialog(options)
}

export function registerAccountIpc(options: RegisterAccountIpcOptions) {
  ipcMain.handle('accounts:getAll', (_event, filters?: AccountFilters) => {
    const db = options.getDatabase()
    let query = 'SELECT * FROM accounts'
    const conditions: string[] = [filters?.isDeleted ? 'is_deleted = 1' : 'is_deleted = 0']
    const params: unknown[] = []

    if (filters?.favoritesOnly) conditions.push('is_favorite = 1')
    if (filters?.platform && filters.platform !== 'all') {
      conditions.push('platform = ?')
      params.push(normalizeAccountPlatform(filters.platform))
    }

    query += ` WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC`
    const hydratedRows = hydrateAccountRows(db, db.prepare(query).all(...params) as any[])
    return filters?.search
      ? hydratedRows.filter((account) => accountMatchesSearch(account, filters.search || ''))
      : hydratedRows
  })

  ipcMain.handle('accounts:getById', (_event, id: string) => {
    const db = options.getDatabase()
    const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any
    if (!row) return null

    const hydrated = hydrateAccountRows(db, [row])[0]
    const fields = db
      .prepare('SELECT * FROM account_custom_fields WHERE account_id = ? ORDER BY sort_order ASC')
      .all(id) as any[]
    hydrated.customFields = fields.map((field) => ({
      ...field,
      field_value: field.is_secret ? decrypt(field.field_value) : field.field_value,
    }))
    return hydrated
  })

  ipcMain.handle('accounts:create', (_event, data: {
    id: string
    name: string
    platform?: string
    username?: string
    password?: string
    phone?: string
    backupEmail?: string
    totpSecret?: string
    notes?: string
  }) => {
    const accountName = String(data.name || '').trim()
    if (!accountName) throw new Error('Account name is required')

    const now = new Date().toISOString()
    options.getDatabase().prepare(`
      INSERT INTO accounts (
        id, name, platform, username, password, phone, backup_email,
        totp_secret, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      accountName,
      normalizeAccountPlatform(data.platform ?? 'google'),
      encrypt(data.username || ''),
      encrypt(data.password || ''),
      encrypt(data.phone || ''),
      encrypt(data.backupEmail || ''),
      encrypt(data.totpSecret || ''),
      data.notes || '',
      now,
      now
    )
    return { id: data.id }
  })

  ipcMain.handle('accounts:update', (_event, id: string, data: AccountUpdateData) => (
    updateAccountRecord(options.getDatabase(), id, data, { encrypt, decrypt })
  ))
  ipcMain.handle('accounts:delete', (_event, id: string) => (
    moveAccountToTrash(options.getDatabase(), id)
  ))
  ipcMain.handle('accounts:restore', (_event, id: string) => (
    restoreAccountFromTrash(options.getDatabase(), id)
  ))
  ipcMain.handle('accounts:hardDelete', (_event, id: string) => (
    hardDeleteAccountRecord(options.getDatabase(), id)
  ))

  ipcMain.handle('accounts:importCsv', async () => {
    const result = await chooseCsvFile(options.getMainWindow())
    if (result.canceled || result.filePaths.length === 0) {
      return { count: 0, invalidTotpCount: 0, skippedRowCount: 0 }
    }

    const parsed = Papa.parse(fs.readFileSync(result.filePaths[0], 'utf-8'), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
    })
    if (parsed.errors.length && parsed.data.length === 0) {
      return { count: 0, invalidTotpCount: 0, skippedRowCount: 0 }
    }

    const db = options.getDatabase()
    let count = 0
    let invalidTotpCount = 0
    let skippedRowCount = 0
    const now = new Date().toISOString()
    const insertAccount = db.prepare(`
      INSERT INTO accounts (
        id, name, platform, username, password, phone, backup_email, totp_secret,
        notes, is_favorite, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertTotp = db.prepare(`
      INSERT INTO totp_accounts (
        id, issuer, label, secret, algorithm, digits, period, otp_type,
        counter, linked_account_id, sort_order, created_at, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const maxTotpOrder = db
      .prepare('SELECT MAX(sort_order) as maxOrder FROM totp_accounts')
      .get() as { maxOrder?: number | null } | undefined
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
          id,
          normalized.name,
          normalizeAccountPlatform(normalized.platform),
          encrypt(normalized.username),
          encrypt(normalized.password),
          encrypt(normalized.phone),
          encrypt(normalized.backupEmail),
          encrypt(normalized.totpSecret),
          normalized.notes,
          0,
          0,
          now,
          now
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
            now,
            ''
          )
          nextTotpOrder += 1
        }
        count += 1
      }
    })()

    return { count, invalidTotpCount, skippedRowCount }
  })

  ipcMain.handle('accounts:addTag', (_event, data: {
    accountId: string
    tagName: string
    color?: string
  }) => addTagToAccount(
    options.getDatabase(),
    data,
    { createId: uuidv4, pickColor: pickTagColor }
  ))
  ipcMain.handle('accounts:getTags', () => getAccountTags(options.getDatabase()))
  ipcMain.handle('accounts:removeTag', (_event, data: { accountId: string; tagId: string }) => (
    removeTagFromAccount(options.getDatabase(), data)
  ))
  ipcMain.handle('accounts:deleteTag', (_event, tagId: string) => (
    deleteTag(options.getDatabase(), tagId)
  ))
  ipcMain.handle('accounts:updateTags', (
    _event,
    patches: Array<{ id: string; name: string; color: string }>
  ) => updateTags(options.getDatabase(), patches))

  ipcMain.handle('accounts:addField', (_event, data: {
    id: string
    accountId: string
    fieldName: string
    fieldValue: string
    isSecret: boolean
  }) => addAccountField(options.getDatabase(), data, { encrypt, decrypt }))
  ipcMain.handle('accounts:updateField', (
    _event,
    id: string,
    data: { fieldName?: string; fieldValue?: string; isSecret?: boolean }
  ) => updateAccountField(options.getDatabase(), id, data, { encrypt, decrypt }))
  ipcMain.handle('accounts:deleteField', (_event, id: string) => (
    deleteAccountField(options.getDatabase(), id)
  ))
}
