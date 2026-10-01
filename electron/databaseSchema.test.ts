import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ACCOUNT_PLATFORMS } from '../shared/accountPlatform'
import { applyDatabaseSchema, hasCurrentDatabaseSchema } from './databaseSchema'
import { TestSqliteDatabase } from './testSqlite'

const ENCRYPTED_SECRET = `${'a'.repeat(32)}:${'b'.repeat(32)}:cafe`

function createLegacySchema(db: TestSqliteDatabase) {
  db.exec(`
    CREATE TABLE tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#1976d2'
    );
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT DEFAULT '',
      password TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      backup_email TEXT DEFAULT '',
      totp_secret TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      is_favorite INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE totp_accounts (
      id TEXT PRIMARY KEY,
      issuer TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL,
      secret TEXT NOT NULL,
      algorithm TEXT DEFAULT 'SHA1',
      digits INTEGER DEFAULT 6,
      period INTEGER DEFAULT 30,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE account_custom_fields (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      field_name TEXT NOT NULL,
      field_value TEXT DEFAULT '',
      is_secret INTEGER DEFAULT 0
    );
    CREATE TABLE account_tags (
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (account_id, tag_id)
    );
  `)
}

describe('database schema migration', () => {
  let db: TestSqliteDatabase

  beforeEach(() => {
    db = new TestSqliteDatabase()
  })

  afterEach(() => {
    db.close()
  })

  it('creates the complete current schema for a new database', () => {
    applyDatabaseSchema(db as any, { encryptIfNeeded: (value) => `enc:${value}` })

    expect(hasCurrentDatabaseSchema(db as any)).toBe(true)
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'secret_services'").get())
      .toEqual({ name: 'secret_services' })
  })

  it('migrates legacy columns and plaintext TOTP secrets atomically', () => {
    createLegacySchema(db)
    db.prepare("INSERT INTO accounts (id, name) VALUES ('account-1', 'Legacy')").run()
    db.prepare(`
      INSERT INTO totp_accounts (id, issuer, label, secret)
      VALUES ('totp-1', 'Legacy', 'user@example.com', 'JBSWY3DPEHPK3PXP')
    `).run()

    expect(hasCurrentDatabaseSchema(db as any)).toBe(false)
    applyDatabaseSchema(db as any, {
      encryptIfNeeded: () => ENCRYPTED_SECRET,
    })

    expect(hasCurrentDatabaseSchema(db as any)).toBe(true)
    expect(db.prepare('SELECT platform, is_deleted, deleted_at FROM accounts WHERE id = ?')
      .get('account-1')).toEqual({ platform: 'other', is_deleted: 0, deleted_at: null })
    expect(db.prepare('SELECT secret, otp_type, counter, source FROM totp_accounts WHERE id = ?')
      .get('totp-1')).toEqual({
        secret: ENCRYPTED_SECRET,
        otp_type: 'totp',
        counter: 0,
        source: '',
      })
  })

  it('preserves supported platforms during startup normalization and repairs only invalid values', () => {
    applyDatabaseSchema(db as any, { encryptIfNeeded: (value) => value })
    const insertAccount = db.prepare('INSERT INTO accounts (id, name, platform) VALUES (?, ?, ?)')
    for (const platform of ACCOUNT_PLATFORMS) {
      insertAccount.run(platform, `${platform} demo`, platform)
    }
    expect(hasCurrentDatabaseSchema(db as any)).toBe(true)

    insertAccount.run('unknown', 'Unknown demo', 'unsupported')
    insertAccount.run('null', 'Unmarked demo', null)
    expect(hasCurrentDatabaseSchema(db as any)).toBe(false)

    applyDatabaseSchema(db as any, { encryptIfNeeded: (value) => value })

    expect(hasCurrentDatabaseSchema(db as any)).toBe(true)
    for (const platform of ACCOUNT_PLATFORMS) {
      expect(db.prepare('SELECT platform FROM accounts WHERE id = ?').get(platform))
        .toEqual({ platform })
    }
    expect(db.prepare("SELECT platform FROM accounts WHERE id IN ('unknown', 'null')").all())
      .toEqual([{ platform: 'other' }, { platform: 'other' }])
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
    expect(db.pragma('foreign_key_check')).toEqual([])
  })

  it('rolls back every schema and data change when a migration step fails', () => {
    createLegacySchema(db)
    db.prepare(`
      INSERT INTO totp_accounts (id, issuer, label, secret)
      VALUES ('totp-1', 'Legacy', 'user@example.com', 'plaintext-secret')
    `).run()

    expect(() => applyDatabaseSchema(db as any, {
      encryptIfNeeded: () => {
        throw new Error('simulated encryption failure')
      },
    })).toThrow('simulated encryption failure')

    const accountColumns = db.pragma('table_info(accounts)') as Array<{ name: string }>
    expect(accountColumns.map((column) => column.name)).not.toContain('platform')
    expect(db.prepare('SELECT secret FROM totp_accounts WHERE id = ?').get('totp-1'))
      .toEqual({ secret: 'plaintext-secret' })
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'secret_services'").get())
      .toBeUndefined()
  })
})
