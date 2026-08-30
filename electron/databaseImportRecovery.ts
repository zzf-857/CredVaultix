import type Database from 'better-sqlite3'

interface RecoverDatabaseAfterFailedImportOptions {
  importError: unknown
  backupPath?: string
  databasePath: string
  fileExists: (filePath: string) => boolean
  restoreDatabase: (backupPath: string, databasePath: string) => void
  initializeDatabase: () => Database.Database
  activateDatabase: (database: Database.Database) => void
}

function recoveryFailure(message: string, importError: unknown) {
  return new Error(`导入失败，且${message}`, { cause: importError })
}

export function recoverDatabaseAfterFailedImport(
  options: RecoverDatabaseAfterFailedImportOptions
): Database.Database {
  if (!options.backupPath || !options.fileExists(options.backupPath)) {
    throw recoveryFailure('无法恢复原数据库：安全备份不存在或已不可用', options.importError)
  }

  let recoveredDatabase: Database.Database | null = null
  try {
    options.restoreDatabase(options.backupPath, options.databasePath)
    recoveredDatabase = options.initializeDatabase()
    options.activateDatabase(recoveredDatabase)
    return recoveredDatabase
  } catch (restoreError) {
    if (recoveredDatabase?.open) {
      try {
        recoveredDatabase.close()
      } catch {
        // Recovery is already fatal; preserve the original recovery failure.
      }
    }
    throw recoveryFailure(
      `自动恢复原数据库失败：${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
      options.importError
    )
  }
}
