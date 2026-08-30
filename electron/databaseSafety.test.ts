import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync, backup as backupSqlite } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import {
  DATA_TABLES,
  MAX_BACKUPS_PER_REASON,
  assertCountsNotReduced,
  assertFullWalCheckpoint,
  backupDatabaseIfExists,
  buildDatabaseBackupPath,
  copySqliteSnapshotIfMissing,
  getExistingTableCounts,
  hasPlaintextTotpSecrets,
  hasServiceInfoSchema,
} from './databaseSafety'

function createFakeDatabase(tableCounts: Record<string, number>) {
  return {
    prepare(sql: string) {
      return {
        get(tableName?: string) {
          if (sql.includes('sqlite_master')) {
            return tableName && tableCounts[tableName] !== undefined ? { name: tableName } : undefined
          }

          const countMatch = sql.match(/COUNT\(\*\) as count FROM ([A-Za-z0-9_]+)/)
          if (countMatch) {
            return { count: tableCounts[countMatch[1]] ?? 0 }
          }

          throw new Error(`Unexpected SQL in fake database: ${sql}`)
        },
      }
    },
  }
}

function openNodeSqliteDatabase(
  filePath: string,
  options: { readonly: true; fileMustExist: true }
) {
  const database = new DatabaseSync(filePath, { readOnly: options.readonly })
  let open = true

  return {
    get open() {
      return open
    },
    prepare: database.prepare.bind(database),
    pragma(source: string, pragmaOptions?: { simple?: boolean }) {
      const row = database.prepare(`PRAGMA ${source}`).get() as Record<string, unknown> | undefined
      return pragmaOptions?.simple && row ? Object.values(row)[0] : row ? [row] : []
    },
    backup(targetPath: string) {
      return backupSqlite(database, targetPath)
    },
    close() {
      if (!open) return
      database.close()
      open = false
    },
  } as any
}

describe('databaseSafety', () => {
  it('accepts only a complete, non-busy WAL checkpoint before a file backup', () => {
    const checkpoint = (result: unknown) => ({
      pragma: () => result,
    })

    expect(() => assertFullWalCheckpoint(checkpoint([
      { busy: 0, log: 8, checkpointed: 8 },
    ]) as any)).not.toThrow()
    expect(() => assertFullWalCheckpoint(checkpoint([
      { busy: 1, log: 8, checkpointed: 6 },
    ]) as any)).toThrow(/checkpoint 未完成/)
    expect(() => assertFullWalCheckpoint(checkpoint([
      { busy: 0, log: 8, checkpointed: 7 },
    ]) as any)).toThrow(/checkpoint 未完成/)
    expect(() => assertFullWalCheckpoint(checkpoint([]) as any)).toThrow(/未返回有效/)
  })

  it('builds a timestamped backup path inside the user data folder', () => {
    const backupPath = buildDatabaseBackupPath('C:/AppData/CredVaultix', new Date('2026-07-01T10:11:12.000Z'))

    expect(backupPath.replace(/\\/g, '/')).toBe(
      'C:/AppData/CredVaultix/credvaultix-before-migration-2026-07-01-101112.db'
    )
  })

  it('uses a distinct purpose in update backups', () => {
    const backupPath = buildDatabaseBackupPath(
      'C:/AppData/CredVaultix',
      new Date('2026-07-01T10:11:12.000Z'),
      'update'
    )

    expect(backupPath.replace(/\\/g, '/')).toBe(
      'C:/AppData/CredVaultix/credvaultix-before-update-2026-07-01-101112.db'
    )
  })

  it('copies an existing database after the caller checkpoints it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-backup-'))
    try {
      const dbPath = join(dir, 'credvaultix.db')
      writeFileSync(dbPath, 'current-data')

      const result = backupDatabaseIfExists(dbPath, dir, new Date('2026-07-01T10:11:12.000Z'))

      expect(result.created).toBe(true)
      expect(result.filePath?.endsWith('credvaultix-before-migration-2026-07-01-101112.db')).toBe(true)
      expect(readFileSync(result.filePath!, 'utf-8')).toBe('current-data')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('skips backup when the database does not exist yet', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-backup-missing-'))
    try {
      const result = backupDatabaseIfExists(join(dir, 'missing.db'), dir)

      expect(result.created).toBe(false)
      expect(result.filePath).toBeUndefined()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('counts only existing core tables', () => {
    const db = createFakeDatabase({ accounts: 2, tags: 1 })

    expect(getExistingTableCounts(db as any, ['accounts', 'totp_accounts', 'tags'])).toEqual({
      accounts: 2,
      tags: 1,
    })
  })

  it('throws when a protected table count is reduced', () => {
    expect(() =>
      assertCountsNotReduced({ accounts: 2, tags: 1 }, { accounts: 1, tags: 1 })
    ).toThrow('Migration reduced protected table accounts from 2 to 1')
  })
})

describe('service info schema readiness', () => {
  it('returns false when service information tables are missing', () => {
    const db = createFakeDatabase({ accounts: 1 })

    expect(hasServiceInfoSchema(db as any)).toBe(false)
  })

  it('returns true when all service information tables exist', () => {
    const db = createFakeDatabase({
      secret_groups: 0,
      secret_services: 0,
      secret_field_groups: 0,
      secret_fields: 0,
      model_provider_profiles: 0,
      model_provider_key_metadata: 0,
    })

    expect(hasServiceInfoSchema(db as any)).toBe(true)
  })

  it('copies a complete SQLite snapshot including uncheckpointed WAL rows', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-wal-snapshot-'))
    const sourcePath = join(dir, 'legacy.db')
    const targetPath = join(dir, 'credvaultix.db')
    const source = new DatabaseSync(sourcePath)

    try {
      source.exec('PRAGMA journal_mode = WAL')
      source.exec('PRAGMA wal_autocheckpoint = 0')
      source.exec(`
        CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL);
        INSERT INTO accounts (id, name) VALUES ('before-checkpoint', 'Existing account');
      `)
      source.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      source.prepare('INSERT INTO accounts (id, name) VALUES (?, ?)')
        .run('wal-only', 'Latest account')

      expect(await copySqliteSnapshotIfMissing(
        sourcePath,
        targetPath,
        openNodeSqliteDatabase
      )).toBe(true)

      const target = new DatabaseSync(targetPath, { readOnly: true })
      try {
        expect(target.prepare('SELECT id, name FROM accounts ORDER BY id').all()).toEqual([
          { id: 'before-checkpoint', name: 'Existing account' },
          { id: 'wal-only', name: 'Latest account' },
        ])
        expect(target.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' })
      } finally {
        target.close()
      }
    } finally {
      source.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('treats model provider metadata as protected service information data', () => {
    expect(DATA_TABLES).toContain('accounts')
    expect(DATA_TABLES).toContain('secret_fields')
    expect(DATA_TABLES).toContain('model_provider_profiles')
    expect(DATA_TABLES).toContain('model_provider_key_metadata')

    const legacyServiceDb = createFakeDatabase({
      secret_groups: 1,
      secret_services: 2,
      secret_field_groups: 1,
      secret_fields: 4,
    })
    expect(hasServiceInfoSchema(legacyServiceDb as any)).toBe(false)
  })
})

describe('TOTP encryption migration detection', () => {
  it('detects plaintext secrets and ignores empty or encrypted values', () => {
    const createTotpDatabase = (secrets: string[]) => ({
      prepare(sql: string) {
        if (sql.includes('sqlite_master')) {
          return { get: () => ({ name: 'totp_accounts' }) }
        }
        if (sql.includes('SELECT secret FROM totp_accounts')) {
          return { all: () => secrets.filter(Boolean).map((secret) => ({ secret })) }
        }
        throw new Error(`Unexpected SQL in fake database: ${sql}`)
      },
    })

    const encrypted = `${'a'.repeat(32)}:${'b'.repeat(32)}:cafe`
    expect(hasPlaintextTotpSecrets(createTotpDatabase([]) as any)).toBe(false)
    expect(hasPlaintextTotpSecrets(createTotpDatabase(['', encrypted]) as any)).toBe(false)
    expect(hasPlaintextTotpSecrets(createTotpDatabase([encrypted, 'JBSWY3DPEHPK3PXP']) as any)).toBe(true)
  })

  it('does not overwrite another backup created during the same second', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-backup-collision-'))
    try {
      const dbPath = join(dir, 'credvaultix.db')
      const now = new Date('2026-07-01T10:11:12.000Z')
      writeFileSync(dbPath, 'first')
      const first = backupDatabaseIfExists(dbPath, dir, now)
      writeFileSync(dbPath, 'second')
      const second = backupDatabaseIfExists(dbPath, dir, now)

      expect(first.filePath).not.toBe(second.filePath)
      expect(second.filePath?.endsWith('-2.db')).toBe(true)
      expect(readFileSync(first.filePath!, 'utf-8')).toBe('first')
      expect(readFileSync(second.filePath!, 'utf-8')).toBe('second')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('backup retention', () => {
  it('keeps only the newest backups of the same reason and never touches other files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-backup-retention-'))
    try {
      const dbPath = join(dir, 'credvaultix.db')
      writeFileSync(dbPath, 'current-data')
      for (const fileName of [
        'credvaultix-before-migration-2026-07-01-100000.db',
        'credvaultix-before-migration-2026-07-01-100001.db',
        'credvaultix-before-migration-2026-07-01-100002.db',
        'credvaultix-before-migration-2026-07-01-100003.db',
        'credvaultix-before-migration-2026-07-01-100004.db',
        'credvaultix-before-migration-2026-07-01-100005.db',
        'credvaultix-before-import-2026-07-01-100000.db',
        'credvaultix-before-import-2026-07-01-100001.db',
        'notes.txt',
      ]) {
        writeFileSync(join(dir, fileName), 'old-data')
      }

      const result = backupDatabaseIfExists(dbPath, dir, new Date('2026-07-01T10:11:12.000Z'))

      expect(result.created).toBe(true)
      expect(MAX_BACKUPS_PER_REASON).toBe(5)
      expect(readdirSync(dir).sort()).toEqual([
        'credvaultix-before-import-2026-07-01-100000.db',
        'credvaultix-before-import-2026-07-01-100001.db',
        'credvaultix-before-migration-2026-07-01-100002.db',
        'credvaultix-before-migration-2026-07-01-100003.db',
        'credvaultix-before-migration-2026-07-01-100004.db',
        'credvaultix-before-migration-2026-07-01-100005.db',
        'credvaultix-before-migration-2026-07-01-101112.db',
        'credvaultix.db',
        'notes.txt',
      ].sort())
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prunes the suffix-free backup before its same-second -2 sibling', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-backup-suffix-'))
    try {
      const dbPath = join(dir, 'credvaultix.db')
      writeFileSync(dbPath, 'current-data')
      for (const fileName of [
        'credvaultix-before-migration-2026-07-01-101112.db',
        'credvaultix-before-migration-2026-07-01-101112-2.db',
        'credvaultix-before-migration-2026-07-01-101113.db',
        'credvaultix-before-migration-2026-07-01-101114.db',
        'credvaultix-before-migration-2026-07-01-101115.db',
      ]) {
        writeFileSync(join(dir, fileName), 'old-data')
      }

      backupDatabaseIfExists(dbPath, dir, new Date('2026-07-01T10:11:16.000Z'))

      const remaining = readdirSync(dir)
      expect(remaining).not.toContain('credvaultix-before-migration-2026-07-01-101112.db')
      expect(remaining).toContain('credvaultix-before-migration-2026-07-01-101112-2.db')
      expect(remaining).toContain('credvaultix-before-migration-2026-07-01-101116.db')
      expect(remaining.filter((name) => name.startsWith('credvaultix-before-migration-')))
        .toHaveLength(MAX_BACKUPS_PER_REASON)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
