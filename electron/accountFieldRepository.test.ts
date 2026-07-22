import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addAccountField, deleteAccountField, updateAccountField } from './accountFieldRepository'
import { TestSqliteDatabase } from './testSqlite'

const dependencies = {
  encrypt: (value: string) => `enc:${value}`,
  decrypt: (value: string) => value.replace(/^enc:/, ''),
  now: () => '2026-07-22T09:00:00.000Z',
}

describe('account custom field repository', () => {
  let db: TestSqliteDatabase

  beforeEach(() => {
    db = new TestSqliteDatabase()
    db.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        is_deleted INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT ''
      );
      CREATE TABLE account_custom_fields (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        field_name TEXT NOT NULL,
        field_value TEXT DEFAULT '',
        is_secret INTEGER DEFAULT 0
      );
      INSERT INTO accounts (id) VALUES ('account-1');
    `)
  })

  afterEach(() => db.close())

  it('adds, updates, and deletes a sensitive field while keeping the parent timestamp current', () => {
    expect(addAccountField(db as any, {
      id: 'field-1',
      accountId: 'account-1',
      fieldName: ' Recovery code ',
      fieldValue: 'secret',
      isSecret: true,
    }, dependencies)).toEqual({ id: 'field-1' })
    expect(db.prepare("SELECT field_name, field_value, is_secret FROM account_custom_fields WHERE id = 'field-1'").get()).toEqual({
      field_name: 'Recovery code',
      field_value: 'enc:secret',
      is_secret: 1,
    })

    expect(updateAccountField(db as any, 'field-1', { isSecret: false }, dependencies)).toEqual({ success: true })
    expect(db.prepare("SELECT field_value, is_secret FROM account_custom_fields WHERE id = 'field-1'").get()).toEqual({
      field_value: 'secret',
      is_secret: 0,
    })

    expect(deleteAccountField(db as any, 'field-1', dependencies.now)).toEqual({ success: true })
    expect(db.prepare("SELECT updated_at AS value FROM accounts WHERE id = 'account-1'").get()?.value)
      .toBe('2026-07-22T09:00:00.000Z')
  })

  it('returns false for stale update and delete requests', () => {
    expect(updateAccountField(db as any, 'missing', { fieldName: 'Name' }, dependencies)).toEqual({ success: false })
    expect(deleteAccountField(db as any, 'missing', dependencies.now)).toEqual({ success: false })
  })

  it('rolls back the field insert when updating the parent account fails', () => {
    db.exec(`
      CREATE TRIGGER reject_account_update BEFORE UPDATE ON accounts
      BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;
    `)

    expect(() => addAccountField(db as any, {
      id: 'field-1',
      accountId: 'account-1',
      fieldName: 'Code',
      fieldValue: 'value',
      isSecret: false,
    }, dependencies)).toThrow(/simulated failure/)
    expect(db.prepare('SELECT COUNT(*) AS value FROM account_custom_fields').get()?.value).toBe(0)
  })

  it('rolls back a field update when updating the parent account fails', () => {
    db.prepare(`
      INSERT INTO account_custom_fields (id, account_id, field_name, field_value, is_secret)
      VALUES ('field-1', 'account-1', 'Old name', 'old value', 0)
    `).run()
    db.exec(`
      CREATE TRIGGER reject_account_update BEFORE UPDATE ON accounts
      BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;
    `)

    expect(() => updateAccountField(db as any, 'field-1', {
      fieldName: 'New name',
      fieldValue: 'new value',
    }, dependencies)).toThrow(/simulated failure/)
    expect(db.prepare("SELECT field_name, field_value FROM account_custom_fields WHERE id = 'field-1'").get()).toEqual({
      field_name: 'Old name',
      field_value: 'old value',
    })
  })

  it('rolls back a field delete when updating the parent account fails', () => {
    db.prepare(`
      INSERT INTO account_custom_fields (id, account_id, field_name, field_value, is_secret)
      VALUES ('field-1', 'account-1', 'Code', 'value', 0)
    `).run()
    db.exec(`
      CREATE TRIGGER reject_account_update BEFORE UPDATE ON accounts
      BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;
    `)

    expect(() => deleteAccountField(db as any, 'field-1', dependencies.now)).toThrow(/simulated failure/)
    expect(db.prepare('SELECT COUNT(*) AS value FROM account_custom_fields').get()?.value).toBe(1)
  })
})
