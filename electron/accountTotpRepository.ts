import type Database from 'better-sqlite3'
import { normalizeOtpInput } from '../shared/otpAuth'

export interface AccountUpdateData {
  name?: string
  platform?: string
  username?: string
  password?: string
  phone?: string
  backupEmail?: string
  totpSecret?: string
  notes?: string
  isFavorite?: number
  createLinkedTotp?: {
    id: string
    issuer: string
    label: string
    algorithm?: string
    digits?: number
    period?: number
    otpType?: string
    counter?: number
  }
}

export interface TotpWriteData {
  id?: string
  issuer?: string
  label?: string
  secret?: string
  algorithm?: string
  digits?: number
  period?: number
  otpType?: string
  counter?: number
  linkedAccountId?: string
}

interface RepositoryDependencies {
  encrypt: (value: string) => string
  now?: () => string
}

interface LinkedTotpRow {
  id: string
  secret: string
  linked_account_id: string | null
}

export function normalizeAccountPlatform(value?: string | null) {
  return value === 'google' || value === 'microsoft' || value === 'other' ? value : 'other'
}

export function normalizeOtpAlgorithm(value?: string | null) {
  const algorithm = String(value || 'SHA1').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return ['SHA1', 'SHA256', 'SHA512'].includes(algorithm) ? algorithm : 'SHA1'
}

export function normalizeOtpDigits(value?: number | null) {
  const digits = Number(value)
  return Number.isInteger(digits) && digits >= 6 && digits <= 10 ? digits : 6
}

export function normalizeOtpPeriod(value?: number | null) {
  const period = Number(value)
  return Number.isInteger(period) && period >= 5 && period <= 300 ? period : 30
}

export function normalizeOtpType(value?: string | null) {
  return String(value || '').toLowerCase() === 'hotp' ? 'hotp' : 'totp'
}

export function normalizeOtpCounter(value?: number | null) {
  const counter = Number(value)
  return Number.isSafeInteger(counter) && counter >= 0 ? counter : 0
}

function now(dependencies: RepositoryDependencies) {
  return dependencies.now?.() ?? new Date().toISOString()
}

function getLinkedTotpRows(db: Database.Database, accountId: string) {
  return db
    .prepare('SELECT id, secret, linked_account_id FROM totp_accounts WHERE linked_account_id = ? ORDER BY created_at ASC, id ASC')
    .all(accountId) as LinkedTotpRow[]
}

function assertValidTotpInput(value: string) {
  const normalized = normalizeOtpInput(value)
  if (!normalized) {
    throw new Error('2FA 密钥必须是有效的 Base32 密钥或 otpauth:// URI')
  }
  return normalized
}

function getTotpValues(data: TotpWriteData) {
  const normalized = assertValidTotpInput(data.secret || '')
  if (!normalized.secret) throw new Error('2FA 密钥不能为空')
  const parsed = normalized.parsedUri
  const issuer = String(parsed?.issuer ?? data.issuer ?? '').trim()
  const label = String(parsed?.label ?? data.label ?? '').trim()
  if (!label) throw new Error('2FA 账户名称不能为空')

  return {
    issuer,
    label,
    secret: normalized.secret,
    algorithm: normalizeOtpAlgorithm(parsed?.algorithm ?? data.algorithm),
    digits: normalizeOtpDigits(parsed?.digits ?? data.digits),
    period: normalizeOtpPeriod(parsed?.period ?? data.period),
    otpType: normalizeOtpType(parsed?.otpType ?? data.otpType),
    counter: normalizeOtpCounter(parsed?.counter ?? data.counter),
  }
}

export function updateAccountRecord(
  db: Database.Database,
  id: string,
  data: AccountUpdateData,
  dependencies: RepositoryDependencies
) {
  const account = db.prepare('SELECT id, name FROM accounts WHERE id = ?').get(id) as { id: string; name: string } | undefined
  if (!account) throw new Error('账号不存在或已被删除')

  const hasTotpChange = Object.prototype.hasOwnProperty.call(data, 'totpSecret')
  const normalizedTotp = hasTotpChange ? assertValidTotpInput(data.totpSecret || '') : null
  const linkedTotpRows = hasTotpChange ? getLinkedTotpRows(db, id) : []
  const requestedLinkedTotp = data.createLinkedTotp
    ? getTotpValues({ ...data.createLinkedTotp, secret: data.totpSecret || '' })
    : null
  if (requestedLinkedTotp && !normalizedTotp?.secret) {
    throw new Error('创建关联 2FA 时必须同时提供有效密钥')
  }
  if (normalizedTotp?.secret && linkedTotpRows.length > 1) {
    throw new Error(`检测到 ${linkedTotpRows.length} 条关联 2FA，请先在 2FA 面板中确认要保留的记录`)
  }

  const updates: string[] = []
  const params: unknown[] = []
  if (data.name !== undefined) {
    const name = data.name.trim()
    if (!name) throw new Error('账号名称不能为空')
    updates.push('name = ?')
    params.push(name)
  }
  if (data.platform !== undefined) { updates.push('platform = ?'); params.push(normalizeAccountPlatform(data.platform)) }
  if (data.username !== undefined) { updates.push('username = ?'); params.push(dependencies.encrypt(data.username)) }
  if (data.password !== undefined) { updates.push('password = ?'); params.push(dependencies.encrypt(data.password)) }
  if (data.phone !== undefined) { updates.push('phone = ?'); params.push(dependencies.encrypt(data.phone)) }
  if (data.backupEmail !== undefined) { updates.push('backup_email = ?'); params.push(dependencies.encrypt(data.backupEmail)) }
  if (normalizedTotp) { updates.push('totp_secret = ?'); params.push(dependencies.encrypt(normalizedTotp.secret)) }
  if (data.notes !== undefined) { updates.push('notes = ?'); params.push(data.notes) }
  if (data.isFavorite !== undefined) { updates.push('is_favorite = ?'); params.push(data.isFavorite ? 1 : 0) }

  const timestamp = now(dependencies)
  const result = db.transaction(() => {
    if (updates.length > 0) {
      db.prepare(`UPDATE accounts SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`)
        .run(...params, timestamp, id)
    }

    if (normalizedTotp) {
      if (!normalizedTotp.secret) {
        // Clearing an account mirror must not destroy the only copy of a 2FA secret.
        db.prepare('UPDATE totp_accounts SET linked_account_id = NULL WHERE linked_account_id = ?').run(id)
      } else if (linkedTotpRows.length === 1) {
        const parsed = normalizedTotp.parsedUri
        const totpUpdates = ['secret = ?']
        const totpParams: unknown[] = [dependencies.encrypt(normalizedTotp.secret)]
        if (requestedLinkedTotp) {
          totpUpdates.push('issuer = ?', 'label = ?', 'algorithm = ?', 'digits = ?', 'period = ?', 'otp_type = ?', 'counter = ?')
          totpParams.push(
            requestedLinkedTotp.issuer,
            requestedLinkedTotp.label,
            requestedLinkedTotp.algorithm,
            requestedLinkedTotp.digits,
            requestedLinkedTotp.period,
            requestedLinkedTotp.otpType,
            requestedLinkedTotp.counter
          )
        } else if (parsed) {
          totpUpdates.push('issuer = ?', 'label = ?', 'algorithm = ?', 'digits = ?', 'period = ?', 'otp_type = ?', 'counter = ?')
          totpParams.push(
            parsed.issuer,
            parsed.label,
            normalizeOtpAlgorithm(parsed.algorithm),
            normalizeOtpDigits(parsed.digits),
            normalizeOtpPeriod(parsed.period),
            normalizeOtpType(parsed.otpType),
            normalizeOtpCounter(parsed.counter)
          )
        }
        db.prepare(`UPDATE totp_accounts SET ${totpUpdates.join(', ')} WHERE id = ?`)
          .run(...totpParams, linkedTotpRows[0].id)
      } else if (requestedLinkedTotp && data.createLinkedTotp) {
        const row = db.prepare('SELECT MAX(sort_order) as maxOrder FROM totp_accounts').get() as { maxOrder?: number | null }
        const nextOrder = (row?.maxOrder || 0) + 1
        db.prepare(`
          INSERT INTO totp_accounts (
            id, issuer, label, secret, algorithm, digits, period, otp_type,
            counter, linked_account_id, sort_order, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          data.createLinkedTotp.id,
          requestedLinkedTotp.issuer,
          requestedLinkedTotp.label,
          dependencies.encrypt(requestedLinkedTotp.secret),
          requestedLinkedTotp.algorithm,
          requestedLinkedTotp.digits,
          requestedLinkedTotp.period,
          requestedLinkedTotp.otpType,
          requestedLinkedTotp.counter,
          id,
          nextOrder,
          timestamp
        )
      }
    }

    const hasExplicitTotpMetadata = Boolean(normalizedTotp?.parsedUri || requestedLinkedTotp)
    if (data.name !== undefined && !hasExplicitTotpMetadata) {
      db.prepare('UPDATE totp_accounts SET issuer = ? WHERE linked_account_id = ?').run(data.name.trim(), id)
    }
    if (data.username !== undefined && !hasExplicitTotpMetadata) {
      const fallbackLabel = data.name?.trim() || account.name
      db.prepare('UPDATE totp_accounts SET label = ? WHERE linked_account_id = ?')
        .run(data.username.trim() || fallbackLabel, id)
    }

    return {
      success: true as const,
      needsTotpLink: Boolean(normalizedTotp?.secret && linkedTotpRows.length === 0 && !requestedLinkedTotp),
      detachedTotpCount: normalizedTotp && !normalizedTotp.secret ? linkedTotpRows.length : 0,
      linkedTotpCount: normalizedTotp?.secret
        ? linkedTotpRows.length || (requestedLinkedTotp ? 1 : 0)
        : 0,
    }
  })

  return result()
}

export function createTotpRecord(
  db: Database.Database,
  data: TotpWriteData & { id: string },
  dependencies: RepositoryDependencies
) {
  const values = getTotpValues(data)
  const linkedAccountId = data.linkedAccountId || null
  const timestamp = now(dependencies)

  return db.transaction(() => {
    let existing: LinkedTotpRow | undefined
    if (linkedAccountId) {
      const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND is_deleted = 0').get(linkedAccountId)
      if (!account) throw new Error('要绑定的主账号不存在或位于回收站')
      const linkedRows = getLinkedTotpRows(db, linkedAccountId)
      if (linkedRows.length > 1) {
        throw new Error(`检测到 ${linkedRows.length} 条关联 2FA，请先确认要保留的记录`)
      }
      existing = linkedRows[0]
    }

    const recordId = existing?.id || data.id
    if (existing) {
      db.prepare(`
        UPDATE totp_accounts
        SET issuer = ?, label = ?, secret = ?, algorithm = ?, digits = ?, period = ?, otp_type = ?, counter = ?
        WHERE id = ?
      `).run(
        values.issuer, values.label, dependencies.encrypt(values.secret), values.algorithm,
        values.digits, values.period, values.otpType, values.counter, recordId
      )
    } else {
      const row = db.prepare('SELECT MAX(sort_order) as maxOrder FROM totp_accounts').get() as { maxOrder?: number | null }
      const nextOrder = (row?.maxOrder || 0) + 1
      db.prepare(`
        INSERT INTO totp_accounts (id, issuer, label, secret, algorithm, digits, period, otp_type, counter, linked_account_id, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        recordId, values.issuer, values.label, dependencies.encrypt(values.secret), values.algorithm,
        values.digits, values.period, values.otpType, values.counter, linkedAccountId, nextOrder, timestamp
      )
    }

    if (linkedAccountId) {
      db.prepare('UPDATE accounts SET totp_secret = ?, updated_at = ? WHERE id = ?')
        .run(dependencies.encrypt(values.secret), timestamp, linkedAccountId)
    }

    return { id: recordId, created: !existing }
  })()
}

export function updateTotpRecord(
  db: Database.Database,
  id: string,
  data: TotpWriteData,
  dependencies: RepositoryDependencies
) {
  const current = db.prepare('SELECT id, linked_account_id FROM totp_accounts WHERE id = ?').get(id) as LinkedTotpRow | undefined
  if (!current) throw new Error('2FA 记录不存在或已被删除')

  const hasSecretChange = Object.prototype.hasOwnProperty.call(data, 'secret')
  const normalized = hasSecretChange ? assertValidTotpInput(data.secret || '') : null
  if (normalized && !normalized.secret) throw new Error('2FA 密钥不能为空')

  if (hasSecretChange && current.linked_account_id && !current.linked_account_id.startsWith('!deleted-')) {
    const linkedRows = getLinkedTotpRows(db, current.linked_account_id)
    if (linkedRows.length > 1) {
      throw new Error(`检测到 ${linkedRows.length} 条关联 2FA，请先确认要保留的记录`)
    }
  }

  const updates: string[] = []
  const params: unknown[] = []
  const parsed = normalized?.parsedUri
  if (data.issuer !== undefined || parsed) { updates.push('issuer = ?'); params.push(String(parsed?.issuer ?? data.issuer ?? '').trim()) }
  if (data.label !== undefined || parsed) {
    const label = String(parsed?.label ?? data.label ?? '').trim()
    if (!label) throw new Error('2FA 账户名称不能为空')
    updates.push('label = ?'); params.push(label)
  }
  if (normalized) { updates.push('secret = ?'); params.push(dependencies.encrypt(normalized.secret)) }
  if (data.algorithm !== undefined || parsed) { updates.push('algorithm = ?'); params.push(normalizeOtpAlgorithm(parsed?.algorithm ?? data.algorithm)) }
  if (data.digits !== undefined || parsed) { updates.push('digits = ?'); params.push(normalizeOtpDigits(parsed?.digits ?? data.digits)) }
  if (data.period !== undefined || parsed) { updates.push('period = ?'); params.push(normalizeOtpPeriod(parsed?.period ?? data.period)) }
  if (data.otpType !== undefined || parsed) { updates.push('otp_type = ?'); params.push(normalizeOtpType(parsed?.otpType ?? data.otpType)) }
  if (data.counter !== undefined || parsed) { updates.push('counter = ?'); params.push(normalizeOtpCounter(parsed?.counter ?? data.counter)) }
  if (updates.length === 0) return { success: true }

  return db.transaction(() => {
    db.prepare(`UPDATE totp_accounts SET ${updates.join(', ')} WHERE id = ?`).run(...params, id)
    if (normalized && current.linked_account_id && !current.linked_account_id.startsWith('!deleted-')) {
      db.prepare('UPDATE accounts SET totp_secret = ?, updated_at = ? WHERE id = ?')
        .run(dependencies.encrypt(normalized.secret), now(dependencies), current.linked_account_id)
    }
    return { success: true }
  })()
}

export function deleteTotpRecord(
  db: Database.Database,
  id: string,
  dependencies: RepositoryDependencies
) {
  const current = db.prepare('SELECT id, secret, linked_account_id FROM totp_accounts WHERE id = ?').get(id) as LinkedTotpRow | undefined
  if (!current) return { success: false }

  return db.transaction(() => {
    db.prepare('DELETE FROM totp_accounts WHERE id = ?').run(id)
    if (current.linked_account_id && !current.linked_account_id.startsWith('!deleted-')) {
      const remaining = db.prepare(`
        SELECT secret FROM totp_accounts
        WHERE linked_account_id = ?
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      `).get(current.linked_account_id) as { secret?: string } | undefined
      db.prepare('UPDATE accounts SET totp_secret = ?, updated_at = ? WHERE id = ?')
        .run(remaining?.secret || '', now(dependencies), current.linked_account_id)
    }
    return { success: true }
  })()
}

export function incrementHotpCounter(db: Database.Database, id: string) {
  return db.transaction(() => {
    const updateResult = db.prepare(`
      UPDATE totp_accounts
      SET counter = counter + 1
      WHERE id = ? AND lower(otp_type) = 'hotp'
    `).run(id)
    if (updateResult.changes !== 1) {
      return { success: false as const, counter: 0 }
    }

    const row = db.prepare('SELECT counter FROM totp_accounts WHERE id = ?')
      .get(id) as { counter: number }
    return { success: true as const, counter: row.counter }
  })()
}
