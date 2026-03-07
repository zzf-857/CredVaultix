import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db: Database.Database

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'prompt-manager.db')
  db = new Database(dbPath)

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL')

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES folders(id),
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#1976d2'
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      folder_id TEXT REFERENCES folders(id),
      is_favorite INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS prompt_tags (
      prompt_id TEXT REFERENCES prompts(id) ON DELETE CASCADE,
      tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (prompt_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_prompts_folder ON prompts(folder_id);
    CREATE INDEX IF NOT EXISTS idx_prompts_favorite ON prompts(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_prompts_updated ON prompts(updated_at);

    CREATE TABLE IF NOT EXISTS totp_accounts (
      id TEXT PRIMARY KEY,
      issuer TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL,
      secret TEXT NOT NULL,
      algorithm TEXT DEFAULT 'SHA1',
      digits INTEGER DEFAULT 6,
      period INTEGER DEFAULT 30,
      otp_type TEXT DEFAULT 'totp',
      counter INTEGER DEFAULT 0,
      linked_account_id TEXT DEFAULT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT DEFAULT '',
      password TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      backup_email TEXT DEFAULT '',
      totp_secret TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      folder_id TEXT,
      is_favorite INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS account_custom_fields (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      field_name TEXT NOT NULL,
      field_value TEXT DEFAULT '',
      is_secret INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_folder ON accounts(folder_id);
    CREATE INDEX IF NOT EXISTS idx_accounts_favorite ON accounts(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_accounts_updated ON accounts(updated_at);
    CREATE INDEX IF NOT EXISTS idx_custom_fields_account ON account_custom_fields(account_id);
  `)

  // Migrations for existing databases
  try {
    db.prepare("ALTER TABLE totp_accounts ADD COLUMN otp_type TEXT DEFAULT 'totp'").run()
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) console.error('Migration error for otp_type:', e)
  }
  
  try {
    db.prepare('ALTER TABLE totp_accounts ADD COLUMN counter INTEGER DEFAULT 0').run()
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) console.error('Migration error for counter:', e)
  }

  try {
    db.prepare('ALTER TABLE totp_accounts ADD COLUMN linked_account_id TEXT DEFAULT NULL').run()
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error for linked_account_id:', e)
    }
  }
}

export function getDatabase() {
  return db
}
