import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { isEncryptedValue } from './encryptionFormat'

export const PROTECTED_TABLES = [
  'accounts',
  'totp_accounts',
  'totp_qr_images',
  'tags',
  'account_custom_fields',
  'account_tags',
] as const

export const SERVICE_INFO_TABLES = [
  'secret_groups',
  'secret_services',
  'secret_field_groups',
  'secret_fields',
  'model_provider_profiles',
  'model_provider_key_metadata',
] as const

export const DATA_TABLES = [...PROTECTED_TABLES, ...SERVICE_INFO_TABLES] as const

export type CoreTableCounts = Record<string, number>

export interface BackupResult {
  created: boolean
  filePath?: string
}

export type SqliteSnapshotDatabaseFactory = (
  filePath: string,
  options: { readonly: true; fileMustExist: true }
) => Database.Database

interface WalCheckpointRow {
  busy: number
  log: number
  checkpointed: number
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

export function buildDatabaseBackupPath(
  userDataPath: string,
  now = new Date(),
  reason: 'migration' | 'import' | 'update' = 'migration'
) {
  return path.join(
    userDataPath,
    `credvaultix-before-${reason}-${formatBackupTimestamp(now)}.db`
  )
}

export const MAX_BACKUPS_PER_REASON = 5

const BACKUP_FILE_PATTERN = /^credvaultix-before-(migration|import|update)-(\d{4}-\d{2}-\d{2}-\d{6})(?:-(\d+))?\.db$/

function pruneBackupsForReason(userDataPath: string, reason: 'migration' | 'import' | 'update') {
  try {
    const backups: Array<{ fileName: string; timestamp: string; suffix: number }> = []
    for (const fileName of fs.readdirSync(userDataPath)) {
      const match = BACKUP_FILE_PATTERN.exec(fileName)
      if (match && match[1] === reason) {
        backups.push({ fileName, timestamp: match[2], suffix: match[3] ? Number(match[3]) : 1 })
      }
    }

    // Same-second collisions get a -2/-3 suffix, and '-' sorts before '.' in file
    // names, so plain lexicographic order would misplace them. Sort by
    // [timestamp, suffix] instead, treating the suffix-less file as suffix 1.
    backups.sort((a, b) => (
      a.timestamp === b.timestamp ? a.suffix - b.suffix : a.timestamp < b.timestamp ? -1 : 1
    ))

    const staleCount = Math.max(0, backups.length - MAX_BACKUPS_PER_REASON)
    for (const backup of backups.slice(0, staleCount)) {
      fs.rmSync(path.join(userDataPath, backup.fileName), { force: true })
    }
  } catch {
    // Pruning is best-effort: a cleanup failure must never fail the backup itself.
  }
}

export function backupDatabaseIfExists(
  dbPath: string,
  userDataPath: string,
  now = new Date(),
  reason: 'migration' | 'import' | 'update' = 'migration'
): BackupResult {
  if (!fs.existsSync(dbPath)) {
    return { created: false }
  }

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }

  const baseBackupPath = buildDatabaseBackupPath(userDataPath, now, reason)
  const extension = path.extname(baseBackupPath)
  const stem = baseBackupPath.slice(0, -extension.length)
  let backupPath = baseBackupPath
  let suffix = 2
  while (fs.existsSync(backupPath)) {
    backupPath = `${stem}-${suffix}${extension}`
    suffix += 1
  }

  fs.copyFileSync(dbPath, backupPath)

  const sourceSize = fs.statSync(dbPath).size
  const backupSize = fs.statSync(backupPath).size
  if (sourceSize !== backupSize) {
    throw new Error(`Database backup size mismatch: ${sourceSize} !== ${backupSize}`)
  }

  pruneBackupsForReason(userDataPath, reason)

  return { created: true, filePath: backupPath }
}

export async function copySqliteSnapshotIfMissing(
  sourcePath: string,
  targetPath: string,
  openDatabase: SqliteSnapshotDatabaseFactory = (filePath, options) => new Database(filePath, options)
) {
  if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) return false

  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  const source = openDatabase(sourcePath, { readonly: true, fileMustExist: true })

  try {
    const sourceCounts = getExistingTableCounts(source, DATA_TABLES)
    await source.backup(targetPath)

    const target = openDatabase(targetPath, { readonly: true, fileMustExist: true })
    try {
      const integrity = target.pragma('integrity_check', { simple: true })
      if (integrity !== 'ok') {
        throw new Error(`SQLite snapshot integrity check failed: ${String(integrity)}`)
      }
      assertCountsNotReduced(sourceCounts, getExistingTableCounts(target, Object.keys(sourceCounts)))
    } finally {
      target.close()
    }

    return true
  } catch (error) {
    if (source.open) source.close()
    if (fs.existsSync(targetPath)) fs.rmSync(targetPath, { force: true })
    throw error
  } finally {
    if (source.open) source.close()
  }
}

export function assertFullWalCheckpoint(db: Database.Database) {
  const rows = db.pragma('wal_checkpoint(FULL)') as WalCheckpointRow[]
  const result = rows[0]

  if (
    !result ||
    !Number.isInteger(result.busy) ||
    !Number.isInteger(result.log) ||
    !Number.isInteger(result.checkpointed)
  ) {
    throw new Error('SQLite 未返回有效的 WAL checkpoint 结果')
  }

  if (result.busy !== 0 || result.checkpointed !== result.log) {
    throw new Error(
      `SQLite WAL checkpoint 未完成（busy=${result.busy}, log=${result.log}, checkpointed=${result.checkpointed}）`
    )
  }
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

export function hasTotpQrImageSchema(db: Database.Database) {
  return hasTable(db, 'totp_qr_images')
}

export function hasPlaintextTotpSecrets(db: Database.Database) {
  if (!hasTable(db, 'totp_accounts')) return false

  const rows = db
    .prepare('SELECT secret FROM totp_accounts WHERE secret <> ?')
    .all('') as Array<{ secret: string }>
  return rows.some((row) => !isEncryptedValue(row.secret))
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
