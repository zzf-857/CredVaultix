import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  hardDeleteAccountRecord,
  moveAccountToTrash,
  restoreAccountFromTrash,
} from './accountLifecycleRepository'
import { TestSqliteDatabase } from './testSqlite'

function createSchema(db: TestSqliteDatabase) {
  db.exec(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT
    );
    CREATE TABLE account_custom_fields (id TEXT PRIMARY KEY, account_id TEXT NOT NULL);
    CREATE TABLE tags (id TEXT PRIMARY KEY);
    CREATE TABLE account_tags (account_id TEXT NOT NULL, tag_id TEXT NOT NULL);
    CREATE TABLE totp_accounts (id TEXT PRIMARY KEY, linked_account_id TEXT);
  `)
}

function insertAccountGraph(db: TestSqliteDatabase, isDeleted = false) {
  db.prepare('INSERT INTO accounts (id, is_deleted, deleted_at) VALUES (?, ?, ?)')
    .run('account-1', isDeleted ? 1 : 0, isDeleted ? '2026-07-22T08:00:00.000Z' : null)
  db.prepare("INSERT INTO account_custom_fields (id, account_id) VALUES ('field-1', 'account-1')").run()
  db.prepare("INSERT INTO tags (id) VALUES ('tag-1')").run()
  db.prepare("INSERT INTO account_tags (account_id, tag_id) VALUES ('account-1', 'tag-1')").run()
  db.prepare("INSERT INTO totp_accounts (id, linked_account_id) VALUES ('totp-1', 'account-1')").run()
}

describe('account lifecycle repository', () => {
  let db: TestSqliteDatabase

  beforeEach(() => {
    db = new TestSqliteDatabase()
    createSchema(db)
  })

  afterEach(() => db.close())

  it('moves and restores an account only from the expected state', () => {
    insertAccountGraph(db)

    expect(moveAccountToTrash(db as any, 'account-1', () => '2026-07-22T09:00:00.000Z')).toEqual({ success: true })
    expect(moveAccountToTrash(db as any, 'account-1')).toEqual({ success: false })
    expect(restoreAccountFromTrash(db as any, 'account-1')).toEqual({ success: true })
    expect(restoreAccountFromTrash(db as any, 'account-1')).toEqual({ success: false })
  })

  it('refuses to hard-delete an active account and leaves every record intact', () => {
    insertAccountGraph(db)

    expect(hardDeleteAccountRecord(db as any, 'account-1')).toEqual({ success: false })
    expect(db.prepare('SELECT COUNT(*) AS value FROM accounts').get()?.value).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS value FROM account_custom_fields').get()?.value).toBe(1)
    expect(db.prepare("SELECT linked_account_id AS value FROM totp_accounts WHERE id = 'totp-1'").get()?.value).toBe('account-1')
  })

  it('hard-deletes only the trashed account while preserving its 2FA as an orphan', () => {
    insertAccountGraph(db, true)

    expect(hardDeleteAccountRecord(db as any, 'account-1')).toEqual({ success: true })
    expect(db.prepare('SELECT COUNT(*) AS value FROM accounts').get()?.value).toBe(0)
    expect(db.prepare('SELECT COUNT(*) AS value FROM account_custom_fields').get()?.value).toBe(0)
    expect(db.prepare('SELECT COUNT(*) AS value FROM account_tags').get()?.value).toBe(0)
    expect(db.prepare("SELECT linked_account_id AS value FROM totp_accounts WHERE id = 'totp-1'").get()?.value).toBe('!deleted-account-1')
  })

  it('rolls back related deletions when the final account delete fails', () => {
    insertAccountGraph(db, true)
    db.exec(`
      CREATE TRIGGER reject_account_delete BEFORE DELETE ON accounts
      BEGIN SELECT RAISE(ABORT, 'simulated delete failure'); END;
    `)

    expect(() => hardDeleteAccountRecord(db as any, 'account-1')).toThrow(/simulated delete failure/)
    expect(db.prepare('SELECT COUNT(*) AS value FROM accounts').get()?.value).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS value FROM account_custom_fields').get()?.value).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS value FROM account_tags').get()?.value).toBe(1)
    expect(db.prepare("SELECT linked_account_id AS value FROM totp_accounts WHERE id = 'totp-1'").get()?.value).toBe('account-1')
  })
})
