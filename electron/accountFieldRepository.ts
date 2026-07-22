import type Database from 'better-sqlite3'

interface FieldDependencies {
  encrypt: (value: string) => string
  decrypt: (value: string) => string
  now?: () => string
}

interface AccountFieldRow {
  account_id: string
  field_value: string
  is_secret: number
}

function normalizeFieldName(value: string) {
  const name = String(value || '').trim()
  if (!name) throw new Error('字段名称不能为空')
  return name
}

function timestamp(dependencies: FieldDependencies) {
  return dependencies.now?.() ?? new Date().toISOString()
}

export function addAccountField(
  db: Database.Database,
  data: { id: string; accountId: string; fieldName: string; fieldValue: string; isSecret: boolean },
  dependencies: FieldDependencies
) {
  const fieldName = normalizeFieldName(data.fieldName)
  return db.transaction(() => {
    const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND is_deleted = 0').get(data.accountId)
    if (!account) throw new Error('账号不存在或位于回收站')

    const value = data.isSecret ? dependencies.encrypt(data.fieldValue) : data.fieldValue
    db.prepare(`
      INSERT INTO account_custom_fields (id, account_id, field_name, field_value, is_secret)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.id, data.accountId, fieldName, value, data.isSecret ? 1 : 0)
    db.prepare('UPDATE accounts SET updated_at = ? WHERE id = ?')
      .run(timestamp(dependencies), data.accountId)
    return { id: data.id }
  })()
}

export function updateAccountField(
  db: Database.Database,
  id: string,
  data: { fieldName?: string; fieldValue?: string; isSecret?: boolean },
  dependencies: FieldDependencies
) {
  const current = db.prepare(`
    SELECT account_id, field_value, is_secret
    FROM account_custom_fields
    WHERE id = ?
  `).get(id) as AccountFieldRow | undefined
  if (!current) return { success: false }

  const currentIsSecret = Boolean(current.is_secret)
  const nextIsSecret = data.isSecret !== undefined ? Boolean(data.isSecret) : currentIsSecret
  const updates: string[] = []
  const params: unknown[] = []
  if (data.fieldName !== undefined) {
    updates.push('field_name = ?')
    params.push(normalizeFieldName(data.fieldName))
  }
  if (data.fieldValue !== undefined || data.isSecret !== undefined) {
    const plainValue = data.fieldValue !== undefined
      ? data.fieldValue
      : currentIsSecret
        ? dependencies.decrypt(current.field_value)
        : current.field_value
    updates.push('field_value = ?')
    params.push(nextIsSecret ? dependencies.encrypt(plainValue) : plainValue)
  }
  if (data.isSecret !== undefined) {
    updates.push('is_secret = ?')
    params.push(nextIsSecret ? 1 : 0)
  }
  if (updates.length === 0) return { success: true }

  return db.transaction(() => {
    const result = db.prepare(`UPDATE account_custom_fields SET ${updates.join(', ')} WHERE id = ?`)
      .run(...params, id)
    if (result.changes === 0) return { success: false }
    db.prepare('UPDATE accounts SET updated_at = ? WHERE id = ?')
      .run(timestamp(dependencies), current.account_id)
    return { success: true }
  })()
}

export function deleteAccountField(
  db: Database.Database,
  id: string,
  now = () => new Date().toISOString()
) {
  const current = db.prepare('SELECT account_id FROM account_custom_fields WHERE id = ?')
    .get(id) as { account_id: string } | undefined
  if (!current) return { success: false }

  return db.transaction(() => {
    const result = db.prepare('DELETE FROM account_custom_fields WHERE id = ?').run(id)
    if (result.changes === 0) return { success: false }
    db.prepare('UPDATE accounts SET updated_at = ? WHERE id = ?').run(now(), current.account_id)
    return { success: true }
  })()
}
