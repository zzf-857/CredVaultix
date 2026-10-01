import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createTotpRecord,
  createTotpRecords,
  deleteTotpRecord,
  incrementHotpCounter,
  updateAccountRecord,
  updateTotpRecord,
} from './accountTotpRepository'
import { TestSqliteDatabase } from './testSqlite'

const OLD_SECRET = 'JBSWY3DPEHPK3PXP'
const NEW_SECRET = 'KRUGS4ZANFZSAYJA'
const deps = {
  encrypt: (value: string) => value ? `enc:${value}` : '',
  decrypt: (value: string) => value.startsWith('enc:') ? value.slice(4) : value,
  now: () => '2026-07-22T08:00:00.000Z',
}

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
      source TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT ''
    );
    CREATE TABLE totp_qr_images (
      totp_account_id TEXT PRIMARY KEY REFERENCES totp_accounts(id) ON DELETE CASCADE,
      encrypted_data BLOB NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'image/png',
      original_name TEXT NOT NULL DEFAULT '',
      original_size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
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

  it.each(['github', 'qq', 'apple'])('updates the %s platform without changing account or linked 2FA data', (platform) => {
    insertAccount(db)
    insertTotp(db)

    updateAccountRecord(db as any, 'account-1', { platform }, deps)

    expect(db.prepare("SELECT platform, username, totp_secret FROM accounts WHERE id = 'account-1'").get())
      .toEqual({ platform, username: 'enc:user@example.com', totp_secret: `enc:${OLD_SECRET}` })
    expect(db.prepare("SELECT secret, linked_account_id FROM totp_accounts WHERE id = 'totp-1'").get())
      .toEqual({ secret: `enc:${OLD_SECRET}`, linked_account_id: 'account-1' })
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

  it('keeps a customized issuer when the account is renamed', () => {
    insertAccount(db)
    insertTotp(db)
    db.prepare("UPDATE totp_accounts SET issuer = 'My Card' WHERE id = 'totp-1'").run()

    updateAccountRecord(db as any, 'account-1', { name: 'Gmail' }, deps)

    expect(db.prepare("SELECT issuer, label FROM totp_accounts WHERE id = 'totp-1'").get()).toEqual({
      issuer: 'My Card',
      label: 'user@example.com',
    })
  })

  it('syncs a mirrored issuer when the account is renamed', () => {
    insertAccount(db)
    insertTotp(db)

    updateAccountRecord(db as any, 'account-1', { name: 'Gmail' }, deps)

    expect(db.prepare("SELECT issuer, label FROM totp_accounts WHERE id = 'totp-1'").get()).toEqual({
      issuer: 'Gmail',
      label: 'user@example.com',
    })
  })

  it('keeps a customized label when the account username changes', () => {
    insertAccount(db)
    insertTotp(db)
    db.prepare("UPDATE totp_accounts SET label = 'Personal' WHERE id = 'totp-1'").run()

    updateAccountRecord(db as any, 'account-1', { username: 'new@example.com' }, deps)

    expect(db.prepare("SELECT issuer, label FROM totp_accounts WHERE id = 'totp-1'").get()).toEqual({
      issuer: 'Google',
      label: 'Personal',
    })
  })

  it('syncs a mirrored label when the account username changes', () => {
    insertAccount(db)
    insertTotp(db)

    updateAccountRecord(db as any, 'account-1', { username: 'new@example.com' }, deps)

    expect(db.prepare("SELECT issuer, label FROM totp_accounts WHERE id = 'totp-1'").get()).toEqual({
      issuer: 'Google',
      label: 'new@example.com',
    })
  })

  it('syncs only still-mirrored fields when name and username change together', () => {
    insertAccount(db)
    insertTotp(db)
    db.prepare("UPDATE totp_accounts SET issuer = 'My Card' WHERE id = 'totp-1'").run()

    updateAccountRecord(db as any, 'account-1', {
      name: 'Gmail',
      username: 'new@example.com',
    }, deps)

    expect(db.prepare("SELECT issuer, label FROM totp_accounts WHERE id = 'totp-1'").get()).toEqual({
      issuer: 'My Card',
      label: 'new@example.com',
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

  it('stores a normalized import source on a new 2FA record', () => {
    const result = createTotpRecord(db as any, {
      id: 'totp-source',
      issuer: 'GitHub',
      label: 'octocat',
      secret: NEW_SECRET,
      source: '  旧手机  导出  ',
    }, deps)

    expect(result).toEqual({ id: 'totp-source', created: true })
    expect(db.prepare("SELECT source AS value FROM totp_accounts WHERE id = 'totp-source'").get()?.value).toBe('旧手机 导出')
  })

  it('imports multiple 2FA records in one batch while reporting invalid rows', () => {
    const result = createTotpRecords(db as any, [
      {
        id: 'totp-batch-1',
        issuer: 'GitHub',
        label: 'first',
        secret: OLD_SECRET,
        source: 'Phone import',
      },
      {
        id: 'totp-batch-invalid',
        issuer: 'Broken',
        label: 'invalid',
        secret: 'not-base32-1',
        source: 'Phone import',
      },
      {
        id: 'totp-batch-2',
        issuer: 'GitLab',
        label: 'second',
        secret: NEW_SECRET,
        source: 'Phone import',
      },
    ], deps)

    expect(result).toEqual({ createdCount: 2, skippedCount: 1 })
    expect(db.prepare('SELECT id FROM totp_accounts ORDER BY sort_order').all()).toEqual([
      { id: 'totp-batch-1' },
      { id: 'totp-batch-2' },
    ])
  })

  it('rolls back the whole batch instead of swallowing a database write failure', () => {
    db.exec(`
      CREATE TRIGGER reject_second_batch_insert BEFORE INSERT ON totp_accounts
      WHEN NEW.id = 'totp-batch-2'
      BEGIN SELECT RAISE(ABORT, 'simulated batch write failure'); END;
    `)

    expect(() => createTotpRecords(db as any, [
      {
        id: 'totp-batch-1',
        issuer: 'GitHub',
        label: 'first',
        secret: OLD_SECRET,
      },
      {
        id: 'totp-batch-2',
        issuer: 'GitLab',
        label: 'second',
        secret: NEW_SECRET,
      },
    ], deps)).toThrow(/simulated batch write failure/)

    expect(db.prepare('SELECT COUNT(*) AS value FROM totp_accounts').get()?.value).toBe(0)
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
