import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TestSqliteDatabase } from './testSqlite'
import { listTotpAccounts } from './totpListRepository'

describe('TOTP list repository', () => {
  let db: TestSqliteDatabase

  beforeEach(() => {
    db = new TestSqliteDatabase()
    db.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        is_deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE totp_accounts (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        secret TEXT NOT NULL,
        linked_account_id TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE totp_qr_images (
        totp_account_id TEXT PRIMARY KEY
      );
      INSERT INTO accounts (id, is_deleted) VALUES
        ('active-account', 0),
        ('trashed-account', 1);
      INSERT INTO totp_accounts (id, label, secret, linked_account_id, sort_order) VALUES
        ('unlinked', 'A', 'enc:a', NULL, 1),
        ('active', 'B', 'enc:b', 'active-account', 2),
        ('trashed', 'C', 'enc:c', 'trashed-account', 3),
        ('missing', 'D', 'enc:d', 'missing-account', 4),
        ('deleted-marker', 'E', 'enc:e', '!deleted-account', 5);
      INSERT INTO totp_qr_images (totp_account_id) VALUES ('active');
    `)
  })

  afterEach(() => {
    db.close()
  })

  it('resolves every linked-account state and QR flag in one list query', () => {
    const prepareCalls: string[] = []
    const instrumented = {
      prepare(sql: string) {
        prepareCalls.push(sql)
        return db.prepare(sql)
      },
    }

    const rows = listTotpAccounts(instrumented as any, {
      decrypt: (value) => value.replace(/^enc:/, ''),
    })

    expect(prepareCalls).toHaveLength(1)
    expect(rows.map((row) => ({
      id: row.id,
      state: row.linked_account_state,
      secret: row.secret,
      hasQrImage: row.has_qr_image,
    }))).toEqual([
      { id: 'unlinked', state: 'unlinked', secret: 'a', hasQrImage: false },
      { id: 'active', state: 'active', secret: 'b', hasQrImage: true },
      { id: 'trashed', state: 'trashed', secret: 'c', hasQrImage: false },
      { id: 'missing', state: 'missing', secret: 'd', hasQrImage: false },
      { id: 'deleted-marker', state: 'missing', secret: 'e', hasQrImage: false },
    ])
  })
})
