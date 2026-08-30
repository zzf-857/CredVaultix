import type Database from 'better-sqlite3'
import fs from 'fs'
import {
  DATA_TABLES,
  assertCountsNotReduced,
  assertDatabaseIntegrity,
  assertFullWalCheckpoint,
  assertTableIdentitiesPreserved,
  backupDatabaseIfExists,
  getExistingTableCounts,
  getExistingTableIdentities,
  removeSqliteSidecarFiles,
  restoreDatabaseFromBackup,
  type CoreTableCounts,
  type TableIdentitySnapshot,
} from './databaseSafety'
import { applyDatabaseSchema, hasCurrentDatabaseSchema } from './databaseSchema'

export interface DatabaseOpenOptions {
  readonly?: boolean
  fileMustExist?: boolean
}

export type DatabaseConnectionFactory = (
  filePath: string,
  options?: DatabaseOpenOptions
) => Database.Database

export interface DatabaseInitializerOptions {
  dbPath: string
  userDataPath: string
  openDatabase: DatabaseConnectionFactory
  encryptIfNeeded: (value: string) => string
  now?: Date
}

interface MigrationSnapshot {
  counts: CoreTableCounts
  identities: TableIdentitySnapshot
}

function captureMigrationSnapshot(database: Database.Database): MigrationSnapshot {
  return {
    counts: getExistingTableCounts(database, DATA_TABLES),
    identities: getExistingTableIdentities(database, DATA_TABLES),
  }
}

function assertMigrationSnapshotPreserved(
  snapshot: MigrationSnapshot,
  database: Database.Database
) {
  assertCountsNotReduced(
    snapshot.counts,
    getExistingTableCounts(database, Object.keys(snapshot.counts))
  )
  assertTableIdentitiesPreserved(
    snapshot.identities,
    getExistingTableIdentities(database, Object.keys(snapshot.identities))
  )
}

function verifyMigrationBackup(
  backupPath: string,
  snapshot: MigrationSnapshot,
  openDatabase: DatabaseConnectionFactory
) {
  const backup = openDatabase(backupPath, { readonly: true, fileMustExist: true })
  try {
    assertDatabaseIntegrity(backup)
    assertMigrationSnapshotPreserved(snapshot, backup)
  } finally {
    backup.close()
  }
}

function createMigrationBackup(
  options: DatabaseInitializerOptions
): { backupPath: string; snapshot: MigrationSnapshot } {
  const checkpointDatabase = options.openDatabase(options.dbPath, { fileMustExist: true })
  let snapshot: MigrationSnapshot
  try {
    snapshot = captureMigrationSnapshot(checkpointDatabase)
    assertFullWalCheckpoint(checkpointDatabase)
  } finally {
    checkpointDatabase.close()
  }

  const backup = backupDatabaseIfExists(
    options.dbPath,
    options.userDataPath,
    options.now ?? new Date(),
    'migration',
    (backupPath) => verifyMigrationBackup(backupPath, snapshot, options.openDatabase)
  )
  if (!backup.created || !backup.filePath || !fs.existsSync(backup.filePath)) {
    throw new Error('数据库迁移已中止：无法创建迁移前安全备份')
  }
  return { backupPath: backup.filePath, snapshot }
}

function databaseNeedsMigration(
  dbPath: string,
  openDatabase: DatabaseConnectionFactory
) {
  const schemaCheck = openDatabase(dbPath, { readonly: true, fileMustExist: true })
  try {
    return !hasCurrentDatabaseSchema(schemaCheck)
  } finally {
    schemaCheck.close()
  }
}

function restoreFailedMigration(
  options: DatabaseInitializerOptions,
  backupPath: string,
  snapshot: MigrationSnapshot
) {
  restoreDatabaseFromBackup(backupPath, options.dbPath)
  const restored = options.openDatabase(options.dbPath, { readonly: true, fileMustExist: true })
  try {
    assertDatabaseIntegrity(restored)
    assertMigrationSnapshotPreserved(snapshot, restored)
  } finally {
    restored.close()
  }
}

export function initializeDatabaseFile(
  options: DatabaseInitializerOptions
): Database.Database {
  const databaseExisted = fs.existsSync(options.dbPath)
  const migration = databaseExisted && databaseNeedsMigration(options.dbPath, options.openDatabase)
    ? createMigrationBackup(options)
    : null

  let candidate: Database.Database | null = null
  try {
    candidate = options.openDatabase(options.dbPath)
    candidate.pragma('journal_mode = WAL')
    candidate.pragma('foreign_keys = ON')

    const snapshotBefore = captureMigrationSnapshot(candidate)
    applyDatabaseSchema(candidate, { encryptIfNeeded: options.encryptIfNeeded })
    assertDatabaseIntegrity(candidate)
    if (!hasCurrentDatabaseSchema(candidate)) {
      throw new Error('数据库迁移后的表结构或加密状态不完整')
    }
    assertMigrationSnapshotPreserved(snapshotBefore, candidate)

    return candidate
  } catch (error) {
    if (candidate?.open) candidate.close()

    if (migration) {
      try {
        restoreFailedMigration(options, migration.backupPath, migration.snapshot)
      } catch (restoreError) {
        throw new Error(
          `数据库迁移失败，且自动恢复备份失败：${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
          { cause: error }
        )
      }
      throw new Error('数据库迁移失败，已自动恢复迁移前备份', { cause: error })
    }

    if (!databaseExisted) {
      removeSqliteSidecarFiles(options.dbPath)
      if (fs.existsSync(options.dbPath)) fs.rmSync(options.dbPath, { force: true })
    }
    throw error
  }
}
