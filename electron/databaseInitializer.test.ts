import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import {
  initializeDatabaseFile,
  type DatabaseConnectionFactory,
  type DatabaseOpenOptions,
} from './databaseInitializer'

const ENCRYPTED_SECRET = `${'a'.repeat(32)}:${'b'.repeat(32)}:cafe`

class NodeSqliteConnection {
  private readonly database: DatabaseSync
  open = true

  constructor(filePath: string, options: DatabaseOpenOptions = {}) {
    if (options.fileMustExist && !existsSync(filePath)) {
      throw new Error(`Database does not exist: ${filePath}`)
    }
    this.database = new DatabaseSync(filePath, { readOnly: options.readonly === true })
  }

  exec(sql: string) {
    return this.database.exec(sql)
  }

  prepare(sql: string) {
    return this.database.prepare(sql)
  }

  pragma(source: string, options?: { simple?: boolean }) {
    const rows = this.database.prepare(`PRAGMA ${source}`).all() as Array<Record<string, unknown>>
    if (options?.simple) {
      return rows[0] ? Object.values(rows[0])[0] : undefined
    }
    return rows
  }

  transaction<T extends (...args: any[]) => any>(operation: T) {
    return (...args: Parameters<T>): ReturnType<T> => {
      this.database.exec('BEGIN')
      try {
        const result = operation(...args)
        this.database.exec('COMMIT')
        return result
      } catch (error) {
        this.database.exec('ROLLBACK')
        throw error
      }
    }
  }

  close() {
    if (!this.open) return
    this.database.close()
    this.open = false
  }
}

const openDatabase: DatabaseConnectionFactory = (filePath, options) => (
  new NodeSqliteConnection(filePath, options) as any
)

function createCurrentDatabase(dbPath: string, userDataPath: string) {
  const db = initializeDatabaseFile({
    dbPath,
    userDataPath,
    openDatabase,
    encryptIfNeeded: () => ENCRYPTED_SECRET,
  })
  db.close()
}

function makeSingleColumnLegacyDatabase(dbPath: string) {
  const legacy = openDatabase(dbPath)
  legacy.exec('ALTER TABLE totp_accounts DROP COLUMN source')
  legacy.prepare(`
    INSERT INTO totp_accounts (id, issuer, label, secret)
    VALUES ('totp-legacy', 'Legacy', 'user@example.com', 'plaintext-secret')
  `).run()
  legacy.close()
}

describe('database file initialization', () => {
  it('backs up and migrates a database that is missing only one legacy column', () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'credvaultix-initialize-'))
    const dbPath = join(userDataPath, 'credvaultix.db')
    try {
      createCurrentDatabase(dbPath, userDataPath)
      makeSingleColumnLegacyDatabase(dbPath)

      const migrated = initializeDatabaseFile({
        dbPath,
        userDataPath,
        openDatabase,
        encryptIfNeeded: () => ENCRYPTED_SECRET,
        now: new Date('2026-08-30T10:00:00.000Z'),
      })
      try {
        const columns = migrated.pragma('table_info(totp_accounts)') as Array<{ name: string }>
        expect(columns.map((column) => column.name)).toContain('source')
        expect(migrated.prepare('SELECT id, secret FROM totp_accounts').get()).toEqual({
          id: 'totp-legacy',
          secret: ENCRYPTED_SECRET,
        })
      } finally {
        migrated.close()
      }

      expect(readdirSync(userDataPath)).toContain(
        'credvaultix-before-migration-2026-08-30-100000.db'
      )
    } finally {
      rmSync(userDataPath, { recursive: true, force: true })
    }
  })

  it('restores the verified file backup when migration fails', () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'credvaultix-restore-'))
    const dbPath = join(userDataPath, 'credvaultix.db')
    try {
      createCurrentDatabase(dbPath, userDataPath)
      makeSingleColumnLegacyDatabase(dbPath)

      expect(() => initializeDatabaseFile({
        dbPath,
        userDataPath,
        openDatabase,
        encryptIfNeeded: () => {
          throw new Error('simulated migration failure')
        },
        now: new Date('2026-08-30T11:00:00.000Z'),
      })).toThrow('已自动恢复迁移前备份')

      const restored = openDatabase(dbPath, { readonly: true, fileMustExist: true })
      try {
        const columns = restored.pragma('table_info(totp_accounts)') as Array<{ name: string }>
        expect(columns.map((column) => column.name)).not.toContain('source')
        expect(restored.prepare('SELECT id, secret FROM totp_accounts').get()).toEqual({
          id: 'totp-legacy',
          secret: 'plaintext-secret',
        })
        expect(restored.pragma('integrity_check', { simple: true })).toBe('ok')
      } finally {
        restored.close()
      }
    } finally {
      rmSync(userDataPath, { recursive: true, force: true })
    }
  })
})
