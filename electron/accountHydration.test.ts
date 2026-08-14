import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getLinkedTotpByAccountIds, getTagsByAccountIds } from './accountHydration'
import { TestSqliteDatabase } from './testSqlite'

const dependencies = {
  decrypt: (value: string) => value.replace(/^enc:/, ''),
}

describe('account hydration batch queries', () => {
  let db: TestSqliteDatabase

  beforeEach(() => {
    db = new TestSqliteDatabase()
    db.exec(`
      CREATE TABLE tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT DEFAULT ''
      );
      CREATE TABLE account_tags (
        account_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (account_id, tag_id)
      );
      CREATE TABLE totp_accounts (
        id TEXT PRIMARY KEY,
        issuer TEXT DEFAULT '',
        label TEXT NOT NULL,
        secret TEXT NOT NULL,
        algorithm TEXT DEFAULT 'SHA1',
        digits INTEGER DEFAULT 6,
        period INTEGER DEFAULT 30,
        otp_type TEXT DEFAULT 'totp',
        counter INTEGER DEFAULT 0,
        linked_account_id TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT ''
      );
      CREATE TABLE totp_qr_images (
        totp_account_id TEXT PRIMARY KEY,
        encrypted_data BLOB
      );

      INSERT INTO tags (id, name, color) VALUES
        ('tag-b', 'Beta', '#b'),
        ('tag-a', 'Alpha', '#a'),
        ('tag-c', 'Gamma', '#c');
      INSERT INTO account_tags (account_id, tag_id) VALUES
        ('account-1', 'tag-b'),
        ('account-1', 'tag-a'),
        ('account-2', 'tag-c');

      INSERT INTO totp_accounts (id, label, secret, linked_account_id, created_at) VALUES
        ('totp-late', 'late', 'enc:LATE', 'account-1', '2026-07-02T00:00:00.000Z'),
        ('totp-early', 'early', 'enc:EARLY', 'account-1', '2026-07-01T00:00:00.000Z'),
        ('totp-other', 'other', 'enc:OTHER', 'account-2', '2026-07-03T00:00:00.000Z'),
        ('totp-unlinked', 'unlinked', 'enc:NONE', NULL, '2026-07-04T00:00:00.000Z');
      INSERT INTO totp_qr_images (totp_account_id) VALUES ('totp-early');
    `)
  })

  afterEach(() => db.close())

  it('groups tags per account ordered by name', () => {
    const tags = getTagsByAccountIds(db as any, ['account-1', 'account-2', 'account-empty'])

    expect(tags.get('account-1')).toEqual([
      { id: 'tag-a', name: 'Alpha', color: '#a' },
      { id: 'tag-b', name: 'Beta', color: '#b' },
    ])
    expect(tags.get('account-2')).toEqual([{ id: 'tag-c', name: 'Gamma', color: '#c' }])
    expect(tags.has('account-empty')).toBe(false)
  })

  it('groups linked 2FA rows per account with decrypted secrets and QR flags', () => {
    const totp = getLinkedTotpByAccountIds(db as any, ['account-1', 'account-2'], dependencies)

    expect(totp.get('account-1')?.map((row) => row.id)).toEqual(['totp-early', 'totp-late'])
    expect(totp.get('account-1')?.[0]).toMatchObject({
      secret: 'EARLY',
      has_qr_image: true,
    })
    expect(totp.get('account-1')?.[1]).toMatchObject({
      secret: 'LATE',
      has_qr_image: false,
    })
    expect(totp.get('account-2')?.map((row) => row.id)).toEqual(['totp-other'])
  })

  it('handles empty input, duplicate ids and chunked queries', () => {
    expect(getTagsByAccountIds(db as any, []).size).toBe(0)
    expect(getLinkedTotpByAccountIds(db as any, [], dependencies).size).toBe(0)

    const chunked = getTagsByAccountIds(
      db as any,
      ['account-1', 'account-1', 'account-2', 'missing'],
      { chunkSize: 1 }
    )
    expect(chunked.get('account-1')?.length).toBe(2)
    expect(chunked.get('account-2')?.length).toBe(1)

    const chunkedTotp = getLinkedTotpByAccountIds(
      db as any,
      ['account-1', 'account-2', 'account-2'],
      dependencies,
      { chunkSize: 1 }
    )
    expect(chunkedTotp.get('account-1')?.length).toBe(2)
    expect(chunkedTotp.get('account-2')?.length).toBe(1)
  })
})
