import type Database from 'better-sqlite3'

export interface HydrationTagRow {
  id: string
  name: string
  color: string
}

export interface HydrationTotpRow {
  id: string
  issuer: string
  label: string
  secret: string
  algorithm: string
  digits: number
  period: number
  otp_type: string
  counter: number
  linked_account_id: string | null
  sort_order: number
  created_at: string
  has_qr_image: boolean
}

interface BatchOptions {
  chunkSize?: number
}

const DEFAULT_CHUNK_SIZE = 400

function uniqueIds(ids: readonly string[]) {
  return Array.from(new Set(ids.filter(Boolean)))
}

function chunkIds(ids: string[], chunkSize: number) {
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += chunkSize) {
    chunks.push(ids.slice(index, index + chunkSize))
  }
  return chunks
}

function placeholders(count: number) {
  return Array.from({ length: count }, () => '?').join(', ')
}

export function getTagsByAccountIds(
  db: Database.Database,
  accountIds: readonly string[],
  options: BatchOptions = {}
): Map<string, HydrationTagRow[]> {
  const tagsByAccount = new Map<string, HydrationTagRow[]>()
  const ids = uniqueIds(accountIds)
  if (ids.length === 0) return tagsByAccount

  for (const chunk of chunkIds(ids, options.chunkSize ?? DEFAULT_CHUNK_SIZE)) {
    const rows = db.prepare(`
      SELECT at.account_id AS account_id, t.id, t.name, t.color
      FROM account_tags at
      INNER JOIN tags t ON t.id = at.tag_id
      WHERE at.account_id IN (${placeholders(chunk.length)})
      ORDER BY t.name ASC
    `).all(...chunk) as Array<HydrationTagRow & { account_id: string }>

    for (const { account_id, ...tag } of rows) {
      const accountTags = tagsByAccount.get(account_id)
      if (accountTags) {
        accountTags.push(tag)
      } else {
        tagsByAccount.set(account_id, [tag])
      }
    }
  }

  return tagsByAccount
}

export function getLinkedTotpByAccountIds(
  db: Database.Database,
  accountIds: readonly string[],
  dependencies: { decrypt: (value: string) => string },
  options: BatchOptions = {}
): Map<string, HydrationTotpRow[]> {
  const totpByAccount = new Map<string, HydrationTotpRow[]>()
  const ids = uniqueIds(accountIds)
  if (ids.length === 0) return totpByAccount

  for (const chunk of chunkIds(ids, options.chunkSize ?? DEFAULT_CHUNK_SIZE)) {
    const rows = db.prepare(`
      SELECT
        t.*,
        EXISTS (
          SELECT 1
          FROM totp_qr_images qi
          WHERE qi.totp_account_id = t.id
        ) AS has_qr_image
      FROM totp_accounts t
      WHERE t.linked_account_id IN (${placeholders(chunk.length)})
      ORDER BY t.created_at ASC, t.id ASC
    `).all(...chunk) as any[]

    for (const row of rows) {
      const totpAccount: HydrationTotpRow = {
        ...row,
        secret: dependencies.decrypt(row.secret),
        has_qr_image: Boolean(row.has_qr_image),
      }
      const accountId = String(row.linked_account_id)
      const linkedRows = totpByAccount.get(accountId)
      if (linkedRows) {
        linkedRows.push(totpAccount)
      } else {
        totpByAccount.set(accountId, [totpAccount])
      }
    }
  }

  return totpByAccount
}
