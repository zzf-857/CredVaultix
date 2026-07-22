import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createTotpRecord,
  deleteTotpRecord,
  incrementHotpCounter,
  updateAccountRecord,
  updateTotpRecord,
} from './accountTotpRepository'
import { TestSqliteDatabase } from './testSqlite'

const OLD_SECRET = 'JBSWY3DPEHPK3PXP'
const NEW_SECRET = 'KRUGS4ZANFZSAYJA'
const deps = { encrypt: (value: string) => value ? `enc:${value}` : '', now: () => '2026-07-22T08:00:00.000Z' }

function createSchema(db: TestSqliteDatabase) {
  db.exec(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT DEFAULT 'other',
      username TEXT DEFAULT '',
      password TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      backup_email TEXT DEFAULT '',
      totp_secret TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      is_favorite INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT ''
    );
    CREATE TABLE totp_accounts (
      id TEXT PRIMARY KEY,
      issuer TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL,
      secret TEXT NOT NULL,
      algorithm TEXT DEFAULT 'SHA1',
      digits INTEGER DEFAULT 6,
      period INTEGER DEFAULT 30,
      otp_type TEXT DEFAULT 'totp',
      counter INTEGER DEFAULT 0,
      linked_account_id TEXT DEFAULT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT ''
    );
  `)
}

function insertAccount(db: TestSqliteDatabase, totpSecret = `enc:${OLD_SECRET}`) {
  db.prepare(`
    INSERT INTO accounts (id, name, platform, username, totp_secret, notes, is_deleted)
    VALUES ('account-1', 'Google', 'google', 'enc:user@example.com', ?, 'old note', 0)
  `).run(totpSecret)
}

function insertTotp(db: TestSqliteDatabase, id = 'totp-1', secret = OLD_SECRET) {
  db.prepare(`
    INSERT INTO totp_accounts (id, issuer, label, secret, linked_account_id, sort_order, created_at)
    VALUES (?, 'Google', 'user@example.com', ?, 'account-1', 1, ?)
  `).run(id, `enc:${secret}`, id)
}

describe('account and linked 2FA repository', () => {
  let db: TestSqliteDatabase

  beforeEach(() => {
    db = new TestSqliteDatabase()
    createSchema(db)
  })

  afterEach(() => db.close())

  it('does not touch a valid linked 2FA when an unrelated account field changes', () => {
    insertAccount(db, '')
    insertTotp(db)

    updateAccountRecord(db as any, 'account-1', { notes: 'new note' }, deps)

    expect(db.prepare("SELECT notes, totp_secret FROM accounts WHERE id = 'account-1'").get()).toEqual({
      notes: 'new note',
      totp_secret: '',
    })
    expect(db.prepare("SELECT secret, linked_account_id FROM totp_accounts WHERE id = 'totp-1'").get()).toEqual({
      secret: `enc:${OLD_SECRET}`,
      linked_account_id: 'account-1',
    })
  })

  it('updates both copies atomically and preserves URI metadata', () => {
    insertAccount(db)
    insertTotp(db)

    const result = updateAccountRecord(db as any, 'account-1', {
      totpSecret: `otpauth://hotp/Example:owner?secret=${NEW_SECRET}&issuer=Example&algorithm=SHA256&digits=8&counter=7`,
    }, deps)

    expect(result).toMatchObject({ success: true, needsTotpLink: false, linkedTotpCount: 1 })
    expect(db.prepare("SELECT totp_secret AS value FROM accounts WHERE id = 'account-1'").get()?.value).toBe(`enc:${NEW_SECRET}`)
    expect(db.prepare("SELECT issuer, label, secret, algorithm, digits, otp_type, counter FROM totp_accounts WHERE id = 'totp-1'").get()).toEqual({
      issuer: 'Example',
      label: 'owner',
      secret: `enc:${NEW_SECRET}`,
      algorithm: 'SHA256',
      digits: 8,
      otp_type: 'hotp',
      counter: 7,
    })
  })

  it('creates the first linked 2FA in the same transaction and keeps URI parameters', () => {
    insertAccount(db, '')

    const result = updateAccountRecord(db as any, 'account-1', {
      totpSecret: `otpauth://hotp/Example:owner?secret=${NEW_SECRET}&issuer=Example&algorithm=SHA256&digits=8&counter=7`,
      createLinkedTotp: {
        id: 'totp-new',
        issuer: 'Fallback',
        label: 'fallback',
      },
    }, deps)

    expect(result).toMatchObject({ success: true, needsTotpLink: false, linkedTotpCount: 1 })
    expect(db.prepare("SELECT totp_secret AS value FROM accounts WHERE id = 'account-1'").get()?.value).toBe(`enc:${NEW_SECRET}`)
    expect(db.prepare("SELECT issuer, label, secret, algorithm, digits, otp_type, counter, linked_account_id FROM totp_accounts WHERE id = 'totp-new'").get()).toEqual({
      issuer: 'Example',
      label: 'owner',
      secret: `enc:${NEW_SECRET}`,
      algorithm: 'SHA256',
      digits: 8,
      otp_type: 'hotp',
      counter: 7,
      linked_account_id: 'account-1',
    })
  })

  it('rolls back the account when creating the first linked 2FA fails', () => {
    insertAccount(db, '')
    db.exec(`
      CREATE TRIGGER reject_totp_insert BEFORE INSERT ON totp_accounts
      BEGIN SELECT RAISE(ABORT, 'simulated insert failure'); END;
    `)

    expect(() => updateAccountRecord(db as any, 'account-1', {
      notes: 'new note',
      totpSecret: NEW_SECRET,
      createLinkedTotp: { id: 'totp-new', issuer: 'Google', label: 'owner' },
    }, deps)).toThrow(/simulated insert failure/)
    expect(db.prepare("SELECT notes, totp_secret FROM accounts WHERE id = 'account-1'").get()).toEqual({
      notes: 'old note',
      totp_secret: '',
    })
    expect(db.prepare('SELECT COUNT(*) AS value FROM totp_accounts').get()?.value).toBe(0)
  })

  it('does not overwrite URI issuer and label when the account identity changes in the same save', () => {
    insertAccount(db)
    insertTotp(db)

    updateAccountRecord(db as any, 'account-1', {
      name: 'Renamed account',
      username: 'renamed@example.com',
      totpSecret: `otpauth://totp/URI%20Issuer:uri-label?secret=${NEW_SECRET}&issuer=URI%20Issuer`,
    }, deps)

    expect(db.prepare("SELECT issuer, label FROM totp_accounts WHERE id = 'totp-1'").get()).toEqual({
      issuer: 'URI Issuer',
      label: 'uri-label',
    })
  })

  it('rejects invalid input before writing either table', () => {
    insertAccount(db)
    insertTotp(db)

    expect(() => updateAccountRecord(db as any, 'account-1', { notes: 'new', totpSecret: 'not-base32-1' }, deps))
      .toThrow(/Base32/)
    expect(db.prepare("SELECT notes, totp_secret FROM accounts WHERE id = 'account-1'").get()).toEqual({
      notes: 'old note',
      totp_secret: `enc:${OLD_SECRET}`,
    })
  })

  it('detaches rather than deletes a 2FA record when the account secret is cleared', () => {
    insertAccount(db)
    insertTotp(db)

    const result = updateAccountRecord(db as any, 'account-1', { totpSecret: '' }, deps)

    expect(result.detachedTotpCount).toBe(1)
    expect(db.prepare("SELECT totp_secret AS value FROM accounts WHERE id = 'account-1'").get()?.value).toBe('')
    expect(db.prepare("SELECT secret, linked_account_id FROM totp_accounts WHERE id = 'totp-1'").get()).toEqual({
      secret: `enc:${OLD_SECRET}`,
      linked_account_id: null,
    })
  })

  it('blocks secret replacement when legacy duplicate links exist without deleting either row', () => {
    insertAccount(db)
    insertTotp(db)
    insertTotp(db, 'totp-2', NEW_SECRET)

    expect(() => updateAccountRecord(db as any, 'account-1', { totpSecret: NEW_SECRET }, deps)).toThrow(/2 条关联 2FA/)
    expect(db.prepare('SELECT COUNT(*) AS value FROM totp_accounts').get()?.value).toBe(2)
  })

  it('upserts a linked record from current database state instead of creating a duplicate', () => {
    insertAccount(db)
    insertTotp(db)

    const result = createTotpRecord(db as any, {
      id: 'new-client-id',
      issuer: 'Google',
      label: 'owner',
      secret: NEW_SECRET,
      linkedAccountId: 'account-1',
    }, deps)

    expect(result).toEqual({ id: 'totp-1', created: false })
    expect(db.prepare('SELECT COUNT(*) AS value FROM totp_accounts').get()?.value).toBe(1)
    expect(db.prepare("SELECT secret AS value FROM totp_accounts WHERE id = 'totp-1'").get()?.value).toBe(`enc:${NEW_SECRET}`)
  })

  it('keeps the remaining linked secret when one legacy duplicate is deleted', () => {
    insertAccount(db)
    insertTotp(db)
    insertTotp(db, 'totp-2', NEW_SECRET)

    deleteTotpRecord(db as any, 'totp-1', deps)

    expect(db.prepare('SELECT COUNT(*) AS value FROM totp_accounts').get()?.value).toBe(1)
    expect(db.prepare("SELECT totp_secret AS value FROM accounts WHERE id = 'account-1'").get()?.value).toBe(`enc:${NEW_SECRET}`)
  })

  it('rolls back the account update if linked 2FA synchronization fails', () => {
    insertAccount(db)
    insertTotp(db)
    db.exec(`
      CREATE TRIGGER reject_totp_update BEFORE UPDATE ON totp_accounts
      BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;
    `)

    expect(() => updateAccountRecord(db as any, 'account-1', { notes: 'new note', totpSecret: NEW_SECRET }, deps))
      .toThrow(/simulated failure/)
    expect(db.prepare("SELECT notes, totp_secret FROM accounts WHERE id = 'account-1'").get()).toEqual({
      notes: 'old note',
      totp_secret: `enc:${OLD_SECRET}`,
    })
  })

  it('syncs an account mirror inside the same transaction when editing from the 2FA panel', () => {
    insertAccount(db)
    insertTotp(db)

    updateTotpRecord(db as any, 'totp-1', { secret: NEW_SECRET }, deps)

    expect(db.prepare("SELECT totp_secret AS value FROM accounts WHERE id = 'account-1'").get()?.value).toBe(`enc:${NEW_SECRET}`)
    expect(db.prepare("SELECT secret AS value FROM totp_accounts WHERE id = 'totp-1'").get()?.value).toBe(`enc:${NEW_SECRET}`)
  })

  it('increments only an existing HOTP record and reports stale targets', () => {
    insertAccount(db)
    insertTotp(db)
    db.prepare("UPDATE totp_accounts SET otp_type = 'hotp', counter = 7 WHERE id = 'totp-1'").run()

    expect(incrementHotpCounter(db as any, 'totp-1')).toEqual({ success: true, counter: 8 })
    expect(incrementHotpCounter(db as any, 'missing')).toEqual({ success: false, counter: 0 })

    db.prepare("UPDATE totp_accounts SET otp_type = 'totp' WHERE id = 'totp-1'").run()
    expect(incrementHotpCounter(db as any, 'totp-1')).toEqual({ success: false, counter: 0 })
    expect(db.prepare("SELECT counter AS value FROM totp_accounts WHERE id = 'totp-1'").get()?.value).toBe(8)
  })
})
