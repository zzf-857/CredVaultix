import fs from 'fs'
import path from 'path'
import type Database from 'better-sqlite3'

export const PROTECTED_TABLES = [
  'accounts',
  'totp_accounts',
  'tags',
  'account_custom_fields',
  'account_tags',
] as const

export const SERVICE_INFO_TABLES = [
  'secret_groups',
  'secret_services',
  'secret_field_groups',
  'secret_fields',
] as const

export type CoreTableCounts = Record<string, number>

export interface BackupResult {
  created: boolean
  filePath?: string
}

function formatBackupTimestamp(now: Date) {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  const hour = String(now.getUTCHours()).padStart(2, '0')
  const minute = String(now.getUTCMinutes()).padStart(2, '0')
  const second = String(now.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}-${hour}${minute}${second}`
}

function assertSafeTableName(tableName: string) {
  if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
    throw new Error(`Unsafe table name: ${tableName}`)
  }
}

export function buildDatabaseBackupPath(userDataPath: string, now = new Date()) {
  return path.join(
    userDataPath,
    `account-manager-before-service-vault-${formatBackupTimestamp(now)}.db`
  )
}

export function backupDatabaseIfExists(dbPath: string, userDataPath: string, now = new Date()): BackupResult {
  if (!fs.existsSync(dbPath)) {
    return { created: false }
  }

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }

  const backupPath = buildDatabaseBackupPath(userDataPath, now)
  fs.copyFileSync(dbPath, backupPath)

  const sourceSize = fs.statSync(dbPath).size
  const backupSize = fs.statSync(backupPath).size
  if (sourceSize !== backupSize) {
    throw new Error(`Database backup size mismatch: ${sourceSize} !== ${backupSize}`)
  }

  return { created: true, filePath: backupPath }
}

export function hasTable(db: Database.Database, tableName: string) {
  assertSafeTableName(tableName)
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name?: string } | undefined
  return Boolean(row?.name)
}

export function getExistingTableCounts(
  db: Database.Database,
  tableNames: readonly string[] = PROTECTED_TABLES
): CoreTableCounts {
  const counts: CoreTableCounts = {}

  for (const tableName of tableNames) {
    assertSafeTableName(tableName)
    if (hasTable(db, tableName)) {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number }
      counts[tableName] = row.count
    }
  }

  return counts
}

export function hasServiceInfoSchema(db: Database.Database) {
  return SERVICE_INFO_TABLES.every((tableName) => hasTable(db, tableName))
}

export function assertCountsNotReduced(before: CoreTableCounts, after: CoreTableCounts) {
  for (const [tableName, beforeCount] of Object.entries(before)) {
    const afterCount = after[tableName]

    if (afterCount === undefined) {
      throw new Error(`Migration removed protected table ${tableName}`)
    }

    if (afterCount < beforeCount) {
      throw new Error(`Migration reduced protected table ${tableName} from ${beforeCount} to ${afterCount}`)
    }
  }
}
