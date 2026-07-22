import type Database from 'better-sqlite3'

export function moveAccountToTrash(
  db: Database.Database,
  id: string,
  now = () => new Date().toISOString()
) {
  const timestamp = now()
  const result = db.prepare(`
    UPDATE accounts
    SET is_deleted = 1, deleted_at = ?
    WHERE id = ? AND is_deleted = 0
  `).run(timestamp, id)
  return { success: result.changes === 1 }
}

export function restoreAccountFromTrash(db: Database.Database, id: string) {
  const result = db.prepare(`
    UPDATE accounts
    SET is_deleted = 0, deleted_at = NULL
    WHERE id = ? AND is_deleted = 1
  `).run(id)
  return { success: result.changes === 1 }
}

export function hardDeleteAccountRecord(db: Database.Database, id: string) {
  const account = db.prepare('SELECT is_deleted FROM accounts WHERE id = ?')
    .get(id) as { is_deleted?: number } | undefined
  if (!account?.is_deleted) return { success: false }

  return db.transaction(() => {
    db.prepare('DELETE FROM account_custom_fields WHERE account_id = ?').run(id)
    db.prepare('DELETE FROM account_tags WHERE account_id = ?').run(id)
    db.prepare('UPDATE totp_accounts SET linked_account_id = ? WHERE linked_account_id = ?')
      .run(`!deleted-${id}`, id)
    const result = db.prepare('DELETE FROM accounts WHERE id = ? AND is_deleted = 1').run(id)
    if (result.changes !== 1) throw new Error('账号状态已变化，未执行彻底删除')
    return { success: true }
  })()
}
