import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addTagToAccount, MAX_ACCOUNT_TAG_LENGTH, removeTagFromAccount } from './accountTagRepository'
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
})
