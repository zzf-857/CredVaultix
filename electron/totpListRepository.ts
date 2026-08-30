import type Database from 'better-sqlite3'

export function listTotpAccounts(
  db: Database.Database,
  dependencies: { decrypt: (value: string) => string }
) {
  const rows = db.prepare(`
    SELECT
      t.*,
      EXISTS (
        SELECT 1
        FROM totp_qr_images qi
        WHERE qi.totp_account_id = t.id
      ) AS has_qr_image,
      CASE
        WHEN t.linked_account_id IS NULL OR t.linked_account_id = '' THEN 'unlinked'
        WHEN t.linked_account_id LIKE '!deleted-%' THEN 'missing'
        WHEN a.id IS NULL THEN 'missing'
        WHEN a.is_deleted = 1 THEN 'trashed'
        ELSE 'active'
      END AS linked_account_state
    FROM totp_accounts t
    LEFT JOIN accounts a ON a.id = t.linked_account_id
    ORDER BY t.sort_order ASC, t.label ASC
  `).all() as any[]

  return rows.map((account) => ({
    ...account,
    secret: dependencies.decrypt(account.secret),
    has_qr_image: Boolean(account.has_qr_image),
  }))
}
