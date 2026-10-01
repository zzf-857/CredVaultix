import type Database from 'better-sqlite3'
import { ACCOUNT_PLATFORMS } from '../shared/accountPlatform'
import { hasPlaintextTotpSecrets, hasTable } from './databaseSafety'

export interface DatabaseMigrationDependencies {
  encryptIfNeeded: (value: string) => string
}

const REQUIRED_SCHEMA_COLUMNS: Record<string, readonly string[]> = {
  tags: ['id', 'name', 'color'],
  totp_accounts: [
    'id', 'issuer', 'label', 'secret', 'algorithm', 'digits', 'period', 'otp_type',
    'counter', 'linked_account_id', 'sort_order', 'source', 'created_at',
  ],
  totp_qr_images: [
    'totp_account_id', 'encrypted_data', 'mime_type', 'original_name',
    'original_size', 'created_at', 'updated_at',
  ],
  accounts: [
    'id', 'name', 'platform', 'username', 'password', 'phone', 'backup_email',
    'totp_secret', 'notes', 'is_favorite', 'is_deleted', 'deleted_at',
    'created_at', 'updated_at',
  ],
  account_custom_fields: [
    'id', 'account_id', 'field_name', 'field_value', 'is_secret', 'sort_order',
  ],
  account_tags: ['account_id', 'tag_id'],
  secret_groups: [
    'id', 'name', 'color', 'sort_order', 'is_collapsed', 'created_at', 'updated_at',
  ],
  secret_services: [
    'id', 'group_id', 'linked_account_id', 'name', 'description', 'url', 'notes',
    'is_favorite', 'is_deleted', 'deleted_at', 'sort_order', 'created_at', 'updated_at',
  ],
  secret_field_groups: [
    'id', 'service_id', 'name', 'color', 'sort_order', 'is_collapsed',
    'created_at', 'updated_at',
  ],
  secret_fields: [
    'id', 'service_id', 'group_id', 'field_name', 'field_value', 'is_secret',
    'sort_order', 'created_at', 'updated_at',
  ],
  model_provider_profiles: [
    'service_id', 'provider_id', 'base_url_field_id', 'created_at', 'updated_at',
  ],
  model_provider_key_metadata: [
    'field_id', 'purpose', 'manual_balance', 'sort_order', 'created_at', 'updated_at',
  ],
}

const LEGACY_COLUMN_MIGRATIONS = [
  { table: 'totp_accounts', column: 'otp_type', definition: "otp_type TEXT DEFAULT 'totp'" },
  { table: 'totp_accounts', column: 'counter', definition: 'counter INTEGER DEFAULT 0' },
  { table: 'totp_accounts', column: 'linked_account_id', definition: 'linked_account_id TEXT DEFAULT NULL' },
  { table: 'totp_accounts', column: 'source', definition: "source TEXT NOT NULL DEFAULT ''" },
  { table: 'accounts', column: 'is_deleted', definition: 'is_deleted INTEGER DEFAULT 0' },
  { table: 'accounts', column: 'deleted_at', definition: 'deleted_at DATETIME DEFAULT NULL' },
  { table: 'accounts', column: 'platform', definition: "platform TEXT DEFAULT 'other'" },
  { table: 'account_custom_fields', column: 'sort_order', definition: 'sort_order INTEGER DEFAULT 0' },
] as const

const DATABASE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#1976d2'
  );

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
    source TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS totp_qr_images (
    totp_account_id TEXT PRIMARY KEY REFERENCES totp_accounts(id) ON DELETE CASCADE,
    encrypted_data BLOB NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'image/png',
    original_name TEXT NOT NULL DEFAULT '',
    original_size INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT DEFAULT 'other',
    username TEXT DEFAULT '',
    password TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    backup_email TEXT DEFAULT '',
    totp_secret TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    is_favorite INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    deleted_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS account_custom_fields (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_value TEXT DEFAULT '',
    is_secret INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS account_tags (
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (account_id, tag_id)
  );

  CREATE INDEX IF NOT EXISTS idx_accounts_favorite ON accounts(is_favorite);
  CREATE INDEX IF NOT EXISTS idx_accounts_updated ON accounts(updated_at);
  CREATE INDEX IF NOT EXISTS idx_custom_fields_account ON account_custom_fields(account_id);
  CREATE INDEX IF NOT EXISTS idx_account_tags_account ON account_tags(account_id);
  CREATE INDEX IF NOT EXISTS idx_account_tags_tag ON account_tags(tag_id);

  CREATE TABLE IF NOT EXISTS secret_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#a8c7fa',
    sort_order INTEGER DEFAULT 0,
    is_collapsed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS secret_services (
    id TEXT PRIMARY KEY,
    group_id TEXT DEFAULT NULL REFERENCES secret_groups(id) ON DELETE SET NULL,
    linked_account_id TEXT DEFAULT NULL REFERENCES accounts(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    url TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    is_favorite INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    deleted_at DATETIME DEFAULT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS secret_field_groups (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES secret_services(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#a8c7fa',
    sort_order INTEGER DEFAULT 0,
    is_collapsed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS secret_fields (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES secret_services(id) ON DELETE CASCADE,
    group_id TEXT DEFAULT NULL REFERENCES secret_field_groups(id) ON DELETE SET NULL,
    field_name TEXT NOT NULL,
    field_value TEXT DEFAULT '',
    is_secret INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS model_provider_profiles (
    service_id TEXT PRIMARY KEY REFERENCES secret_services(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    base_url_field_id TEXT DEFAULT NULL REFERENCES secret_fields(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS model_provider_key_metadata (
    field_id TEXT PRIMARY KEY REFERENCES secret_fields(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL DEFAULT '',
    manual_balance TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_secret_services_group ON secret_services(group_id);
  CREATE INDEX IF NOT EXISTS idx_secret_services_deleted ON secret_services(is_deleted);
  CREATE INDEX IF NOT EXISTS idx_secret_field_groups_service ON secret_field_groups(service_id);
  CREATE INDEX IF NOT EXISTS idx_secret_fields_service ON secret_fields(service_id);
  CREATE INDEX IF NOT EXISTS idx_secret_fields_group ON secret_fields(group_id);
  CREATE INDEX IF NOT EXISTS idx_model_provider_keys_sort ON model_provider_key_metadata(sort_order);
`

const ACCOUNT_PLATFORM_PLACEHOLDERS = ACCOUNT_PLATFORMS.map(() => '?').join(', ')

function getTableColumns(db: Database.Database, tableName: string) {
  return new Set(
    (db.pragma(`table_info(${tableName})`) as Array<{ name: string }>).map((row) => row.name)
  )
}

function ensureLegacyColumns(db: Database.Database) {
  const columnsByTable = new Map<string, Set<string>>()

  for (const migration of LEGACY_COLUMN_MIGRATIONS) {
    const columns = columnsByTable.get(migration.table) ?? getTableColumns(db, migration.table)
    columnsByTable.set(migration.table, columns)
    if (columns.has(migration.column)) continue

    db.exec(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.definition}`)
    columns.add(migration.column)
  }
}

export function hasCurrentDatabaseSchema(db: Database.Database) {
  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_SCHEMA_COLUMNS)) {
    if (!hasTable(db, tableName)) return false
    const columns = getTableColumns(db, tableName)
    if (requiredColumns.some((column) => !columns.has(column))) return false
  }

  const invalidPlatform = db.prepare(`
    SELECT 1
    FROM accounts
    WHERE platform IS NULL OR platform NOT IN (${ACCOUNT_PLATFORM_PLACEHOLDERS})
    LIMIT 1
  `).get(...ACCOUNT_PLATFORMS)

  return !invalidPlatform && !hasPlaintextTotpSecrets(db)
}

export function applyDatabaseSchema(
  db: Database.Database,
  dependencies: DatabaseMigrationDependencies
) {
  db.transaction(() => {
    db.exec(DATABASE_SCHEMA_SQL)
    ensureLegacyColumns(db)
    db.exec('CREATE INDEX IF NOT EXISTS idx_totp_accounts_linked_account ON totp_accounts(linked_account_id)')

    db.prepare(`
      UPDATE accounts
      SET platform = 'other'
      WHERE platform IS NULL OR platform NOT IN (${ACCOUNT_PLATFORM_PLACEHOLDERS})
    `).run(...ACCOUNT_PLATFORMS)

    const plaintextTotpRows = db
      .prepare('SELECT id, secret FROM totp_accounts WHERE secret <> ?')
      .all('') as Array<{ id: string; secret: string }>
    const updateSecret = db.prepare('UPDATE totp_accounts SET secret = ? WHERE id = ?')

    for (const row of plaintextTotpRows) {
      const encryptedSecret = dependencies.encryptIfNeeded(row.secret)
      if (encryptedSecret !== row.secret) {
        updateSecret.run(encryptedSecret, row.id)
      }
    }
  })()
}
