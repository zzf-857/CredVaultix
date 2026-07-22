import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addTagToAccount, deleteTag, getAccountTags, MAX_ACCOUNT_TAG_LENGTH, removeTagFromAccount } from './accountTagRepository'
import { TestSqliteDatabase } from './testSqlite'

const dependencies = {
  createId: () => 'tag-1',
  pickColor: () => '#a8c7fa',
  now: () => '2026-07-22T08:00:00.000Z',
}

describe('account tag repository', () => {
  let db: TestSqliteDatabase

  beforeEach(() => {
    db = new TestSqliteDatabase()
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE accounts (id TEXT PRIMARY KEY, is_deleted INTEGER DEFAULT 0, updated_at TEXT DEFAULT '');
      CREATE TABLE tags (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT NOT NULL);
      CREATE TABLE account_tags (
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (account_id, tag_id)
      );
      INSERT INTO accounts (id) VALUES ('account-1'), ('account-2');
    `)
  })

  afterEach(() => db.close())

  it('adds a tag and removes its unused definition in transactions', () => {
    expect(addTagToAccount(db as any, { accountId: 'account-1', tagName: 'GitHub' }, dependencies))
      .toEqual({ tagId: 'tag-1', linked: true })
    expect(removeTagFromAccount(db as any, { accountId: 'account-1', tagId: 'tag-1' }, dependencies.now))
      .toEqual({ success: true, removed: true, deletedUnusedTag: true })
    expect(db.prepare('SELECT COUNT(*) AS value FROM tags').get()?.value).toBe(0)
  })

  it('preserves a shared tag when removing it from only one account', () => {
    addTagToAccount(db as any, { accountId: 'account-1', tagName: 'GitHub' }, dependencies)
    addTagToAccount(db as any, { accountId: 'account-2', tagName: 'github' }, dependencies)

    const result = removeTagFromAccount(db as any, { accountId: 'account-1', tagId: 'tag-1' }, dependencies.now)

    expect(result.deletedUnusedTag).toBe(false)
    expect(db.prepare('SELECT COUNT(*) AS value FROM tags').get()?.value).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS value FROM account_tags').get()?.value).toBe(1)
  })

  it('lists the reusable tag catalog with account usage counts', () => {
    addTagToAccount(db as any, { accountId: 'account-1', tagName: 'GitHub' }, dependencies)
    addTagToAccount(db as any, { accountId: 'account-2', tagName: 'github' }, dependencies)

    expect(getAccountTags(db as any)).toEqual([
      { id: 'tag-1', name: 'GitHub', color: '#a8c7fa', usage_count: 2 },
    ])
  })

  it('rolls back a newly created tag when linking fails', () => {
    db.exec(`
      CREATE TRIGGER reject_tag_link BEFORE INSERT ON account_tags
      BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;
    `)

    expect(() => addTagToAccount(db as any, { accountId: 'account-1', tagName: 'GitHub' }, dependencies))
      .toThrow(/simulated failure/)
    expect(db.prepare('SELECT COUNT(*) AS value FROM tags').get()?.value).toBe(0)
  })

  it('rejects empty and overlong tag names before writing', () => {
    expect(() => addTagToAccount(db as any, { accountId: 'account-1', tagName: ' ' }, dependencies)).toThrow(/不能为空/)
    expect(() => addTagToAccount(db as any, { accountId: 'account-1', tagName: 'x'.repeat(MAX_ACCOUNT_TAG_LENGTH + 1) }, dependencies))
      .toThrow(/不能超过/)
    expect(db.prepare('SELECT COUNT(*) AS value FROM tags').get()?.value).toBe(0)
  })

  it('deletes a shared tag and its links without deleting accounts', () => {
    addTagToAccount(db as any, { accountId: 'account-1', tagName: 'GitHub' }, dependencies)
    addTagToAccount(db as any, { accountId: 'account-2', tagName: 'github' }, dependencies)

    const result = deleteTag(db as any, 'tag-1', dependencies.now)

    expect(result).toEqual({
      success: true,
      tagName: 'GitHub',
      affectedAccounts: 2,
      removedLinks: 2,
    })
    expect(db.prepare('SELECT COUNT(*) AS value FROM accounts').get()?.value).toBe(2)
    expect(db.prepare('SELECT COUNT(*) AS value FROM tags').get()?.value).toBe(0)
    expect(db.prepare('SELECT COUNT(*) AS value FROM account_tags').get()?.value).toBe(0)
    expect(db.prepare('SELECT COUNT(*) AS value FROM accounts WHERE updated_at = ?').get(dependencies.now())?.value).toBe(2)
  })

  it('rolls back link and account timestamp changes when deleting the tag fails', () => {
    addTagToAccount(db as any, { accountId: 'account-1', tagName: 'GitHub' }, dependencies)
    const originalUpdatedAt = db.prepare("SELECT updated_at AS value FROM accounts WHERE id = 'account-1'").get()?.value
    db.exec(`
      CREATE TRIGGER reject_tag_delete BEFORE DELETE ON tags
      BEGIN SELECT RAISE(ABORT, 'simulated delete failure'); END;
    `)

    expect(() => deleteTag(db as any, 'tag-1', dependencies.now)).toThrow(/simulated delete failure/)
    expect(db.prepare('SELECT COUNT(*) AS value FROM accounts').get()?.value).toBe(2)
    expect(db.prepare('SELECT COUNT(*) AS value FROM tags').get()?.value).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS value FROM account_tags').get()?.value).toBe(1)
    expect(db.prepare("SELECT updated_at AS value FROM accounts WHERE id = 'account-1'").get()?.value).toBe(originalUpdatedAt)
  })

  it('deletes an unused tag without changing any account', () => {
    db.prepare("INSERT INTO tags (id, name, color) VALUES ('tag-orphan', 'Unused', '#ffffff')").run()

    expect(deleteTag(db as any, 'tag-orphan', dependencies.now)).toEqual({
      success: true,
      tagName: 'Unused',
      affectedAccounts: 0,
      removedLinks: 0,
    })
    expect(db.prepare('SELECT COUNT(*) AS value FROM accounts').get()?.value).toBe(2)
    expect(db.prepare('SELECT COUNT(*) AS value FROM tags').get()?.value).toBe(0)
  })

  it('returns a no-op result for an unknown tag id', () => {
    expect(deleteTag(db as any, 'missing-tag', dependencies.now)).toEqual({
      success: false,
      tagName: '',
      affectedAccounts: 0,
      removedLinks: 0,
    })
    expect(db.prepare('SELECT COUNT(*) AS value FROM accounts').get()?.value).toBe(2)
    expect(db.prepare('SELECT COUNT(*) AS value FROM tags').get()?.value).toBe(0)
    expect(db.prepare('SELECT COUNT(*) AS value FROM account_tags').get()?.value).toBe(0)
  })
})
