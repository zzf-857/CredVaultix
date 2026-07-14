import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertCountsNotReduced,
  backupDatabaseIfExists,
  buildDatabaseBackupPath,
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

describe('databaseSafety', () => {
  it('builds a timestamped backup path inside the user data folder', () => {
    const backupPath = buildDatabaseBackupPath('C:/AppData/CredVaultix', new Date('2026-07-01T10:11:12.000Z'))

    expect(backupPath.replace(/\\/g, '/')).toBe(
      'C:/AppData/CredVaultix/credvaultix-before-migration-2026-07-01-101112.db'
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
    })

    expect(hasServiceInfoSchema(db as any)).toBe(true)
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
