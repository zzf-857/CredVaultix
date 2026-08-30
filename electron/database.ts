import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { encryptIfNeeded } from './crypto'
import { initializeDatabaseFile } from './databaseInitializer'

let db: Database.Database
export const DATABASE_FILE_NAME = 'credvaultix.db'

export function initDatabase(): Database.Database {
  const userDataPath = app.getPath('userData')
  db = initializeDatabaseFile({
    dbPath: path.join(userDataPath, DATABASE_FILE_NAME),
    userDataPath,
    openDatabase: (filePath, options) => new Database(filePath, options),
    encryptIfNeeded,
  })
  return db
}

export function getDatabase(): Database.Database {
  return db
}
