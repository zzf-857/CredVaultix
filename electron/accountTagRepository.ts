import type Database from 'better-sqlite3'

export const MAX_ACCOUNT_TAG_LENGTH = 64

interface TagDependencies {
  createId: () => string
  pickColor: (name: string) => string
  now?: () => string
}

function normalizeTagName(value: string) {
  const name = String(value || '').trim()
  if (!name) throw new Error('标签名称不能为空')
  if (name.length > MAX_ACCOUNT_TAG_LENGTH) {
    throw new Error(`标签名称不能超过 ${MAX_ACCOUNT_TAG_LENGTH} 个字符`)
  }
  return name
}

export function getAccountTags(db: Database.Database) {
  return db.prepare(`
    SELECT t.id, t.name, t.color, COUNT(at.account_id) AS usage_count
    FROM tags t
    LEFT JOIN account_tags at ON at.tag_id = t.id
    GROUP BY t.id, t.name, t.color
    ORDER BY usage_count DESC, t.name COLLATE NOCASE ASC
  `).all() as Array<{ id: string; name: string; color: string; usage_count: number }>
}

export function addTagToAccount(
  db: Database.Database,
  data: { accountId: string; tagName: string; color?: string },
  dependencies: TagDependencies
) {
  const tagName = normalizeTagName(data.tagName)
  return db.transaction(() => {
    const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND is_deleted = 0').get(data.accountId)
    if (!account) throw new Error('账号不存在或位于回收站')

    let tag = db.prepare('SELECT id, name, color FROM tags WHERE lower(name) = lower(?)').get(tagName) as
      | { id: string; name: string; color: string }
      | undefined
    if (!tag) {
      tag = { id: dependencies.createId(), name: tagName, color: data.color || dependencies.pickColor(tagName) }
      db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(tag.id, tag.name, tag.color)
    }

    const linkResult = db.prepare('INSERT OR IGNORE INTO account_tags (account_id, tag_id) VALUES (?, ?)')
      .run(data.accountId, tag.id)
    if (linkResult.changes > 0) {
      db.prepare('UPDATE accounts SET updated_at = ? WHERE id = ?')
        .run(dependencies.now?.() ?? new Date().toISOString(), data.accountId)
    }
    return { tagId: tag.id, linked: linkResult.changes > 0 }
  })()
}

export function removeTagFromAccount(
  db: Database.Database,
  data: { accountId: string; tagId: string },
  now = () => new Date().toISOString()
) {
  return db.transaction(() => {
    const result = db.prepare('DELETE FROM account_tags WHERE account_id = ? AND tag_id = ?')
      .run(data.accountId, data.tagId)
    let deletedUnusedTag = false
    if (result.changes > 0) {
      db.prepare('UPDATE accounts SET updated_at = ? WHERE id = ?').run(now(), data.accountId)
      const usage = db.prepare('SELECT COUNT(*) AS count FROM account_tags WHERE tag_id = ?').get(data.tagId) as { count: number }
      if (usage.count === 0) {
        deletedUnusedTag = db.prepare('DELETE FROM tags WHERE id = ?').run(data.tagId).changes > 0
      }
    }
    return { success: result.changes > 0, removed: result.changes > 0, deletedUnusedTag }
  })()
}

export function deleteTag(
  db: Database.Database,
  tagId: string,
  now = () => new Date().toISOString()
) {
  const normalizedTagId = String(tagId || '').trim()
  if (!normalizedTagId) throw new Error('标签 ID 不能为空')

  return db.transaction(() => {
    const tag = db.prepare('SELECT id, name FROM tags WHERE id = ?').get(normalizedTagId) as
      | { id: string; name: string }
      | undefined
    if (!tag) {
      return { success: false, tagName: '', affectedAccounts: 0, removedLinks: 0 }
    }

    const updatedAccounts = db.prepare(`
      UPDATE accounts
      SET updated_at = ?
      WHERE id IN (SELECT account_id FROM account_tags WHERE tag_id = ?)
    `).run(now(), normalizedTagId).changes
    const removedLinks = db.prepare('DELETE FROM account_tags WHERE tag_id = ?').run(normalizedTagId).changes
    const deleted = db.prepare('DELETE FROM tags WHERE id = ?').run(normalizedTagId).changes
    if (deleted !== 1) throw new Error('标签删除失败')

    return {
      success: true,
      tagName: tag.name,
      affectedAccounts: updatedAccounts,
      removedLinks,
    }
  })()
}
