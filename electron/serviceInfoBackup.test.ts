import { describe, expect, it } from 'vitest'
import {
  SERVICE_INFO_BACKUP_VERSION,
  captureLegacyServiceAccountLinks,
  clearServiceInfoBackupTables,
  hasServiceInfoBackupData,
  importServiceInfoBackupData,
  readServiceInfoBackupData,
  restoreLegacyServiceAccountLinks,
} from './serviceInfoBackup'
import { TestSqliteDatabase } from './testSqlite'

class FakeDatabase {
  allRows = new Map<string, unknown[]>()
  runCalls: string[] = []
  paramsBySql = new Map<string, unknown[][]>()

  prepare(sql: string) {
    return {
      all: () => this.allRows.get(sql) || [],
      run: (...params: unknown[]) => {
        this.runCalls.push(sql)
        const rows = this.paramsBySql.get(sql) || []
        rows.push(params)
        this.paramsBySql.set(sql, rows)
      },
    }
  }
}

function createBackupDatabase() {
  const db = new TestSqliteDatabase()
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE secret_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_collapsed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );
    CREATE TABLE secret_services (
      id TEXT PRIMARY KEY,
      group_id TEXT REFERENCES secret_groups(id) ON DELETE SET NULL,
      linked_account_id TEXT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      url TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      is_favorite INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );
    CREATE TABLE secret_field_groups (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL REFERENCES secret_services(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_collapsed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );
    CREATE TABLE secret_fields (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL REFERENCES secret_services(id) ON DELETE CASCADE,
      group_id TEXT REFERENCES secret_field_groups(id) ON DELETE SET NULL,
      field_name TEXT NOT NULL,
      field_value TEXT DEFAULT '',
      is_secret INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );
    CREATE TABLE model_provider_profiles (
      service_id TEXT PRIMARY KEY REFERENCES secret_services(id) ON DELETE CASCADE,
      provider_id TEXT NOT NULL,
      base_url_field_id TEXT REFERENCES secret_fields(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );
    CREATE TABLE model_provider_key_metadata (
      field_id TEXT PRIMARY KEY REFERENCES secret_fields(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL DEFAULT '',
      manual_balance TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );
  `)
  return db
}

describe('serviceInfoBackup', () => {
  it('uses the backup version that includes service information tables', () => {
    expect(SERVICE_INFO_BACKUP_VERSION).toBe(7)
  })

  it('reads all service information tables into the JSON payload', () => {
    const db = new FakeDatabase()
    db.allRows.set('SELECT * FROM secret_groups', [{ id: 'g1' }])
    db.allRows.set('SELECT * FROM secret_services', [{ id: 's1' }])
    db.allRows.set('SELECT * FROM secret_field_groups', [{ id: 'fg1' }])
    db.allRows.set('SELECT * FROM secret_fields', [{ id: 'f1' }])
    db.allRows.set('SELECT * FROM model_provider_profiles', [{ service_id: 's1' }])
    db.allRows.set('SELECT * FROM model_provider_key_metadata', [{ field_id: 'f1' }])

    expect(readServiceInfoBackupData(db as any)).toEqual({
      secretGroups: [{ id: 'g1' }],
      secretServices: [{ id: 's1' }],
      secretFieldGroups: [{ id: 'fg1' }],
      secretFields: [{ id: 'f1' }],
      modelProviderProfiles: [{ service_id: 's1' }],
      modelProviderKeyMetadata: [{ field_id: 'f1' }],
    })
  })

  it('clears service information tables from children to parents before import', () => {
    const db = new FakeDatabase()
    clearServiceInfoBackupTables(db as any)

    expect(db.runCalls).toEqual([
      'DELETE FROM model_provider_key_metadata',
      'DELETE FROM model_provider_profiles',
      'DELETE FROM secret_fields',
      'DELETE FROM secret_field_groups',
      'DELETE FROM secret_services',
      'DELETE FROM secret_groups',
    ])
  })

  it('imports service information records with safe defaults', () => {
    const db = new FakeDatabase()

    importServiceInfoBackupData(db as any, {
      secretGroups: [{ id: 'g1', name: 'MCP' }],
      secretServices: [{ id: 's1', group_id: 'g1', name: 'Context7' }],
      secretFieldGroups: [{ id: 'fg1', service_id: 's1', name: '生产环境' }],
      secretFields: [{ id: 'f1', service_id: 's1', field_name: 'API Key' }],
      modelProviderProfiles: [{ service_id: 's1', provider_id: 'openai', base_url_field_id: null }],
      modelProviderKeyMetadata: [{ field_id: 'f1', purpose: '生产', manual_balance: '$10', sort_order: 1 }],
    })

    const serviceSql = `
    INSERT INTO secret_services (id, group_id, linked_account_id, name, description, url, notes, is_favorite, is_deleted, deleted_at, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    const fieldSql = 'INSERT INTO secret_fields (id, service_id, group_id, field_name, field_value, is_secret, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    const profileSql = `
    INSERT INTO model_provider_profiles (
      service_id, provider_id, base_url_field_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?)
  `
    const metadataSql = `
    INSERT INTO model_provider_key_metadata (
      field_id, purpose, manual_balance, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `

    expect(db.paramsBySql.get(serviceSql)?.[0]).toEqual([
      's1',
      'g1',
      null,
      'Context7',
      '',
      '',
      '',
      0,
      0,
      null,
      0,
      expect.any(String),
      expect.any(String),
    ])
    expect(db.paramsBySql.get(fieldSql)?.[0]).toEqual([
      'f1',
      's1',
      null,
      'API Key',
      '',
      1,
      0,
      expect.any(String),
      expect.any(String),
    ])
    expect(db.paramsBySql.get(profileSql)?.[0]).toEqual([
      's1',
      'openai',
      null,
      expect.any(String),
      expect.any(String),
    ])
    expect(db.paramsBySql.get(metadataSql)?.[0]).toEqual([
      'f1',
      '生产',
      '$10',
      1,
      expect.any(String),
      expect.any(String),
    ])
  })

  it('leaves existing service information untouched for legacy backups without service arrays', () => {
    const db = new FakeDatabase()

    importServiceInfoBackupData(db as any, {})

    expect(db.runCalls).toEqual([])
  })

  it('preserves legacy service links only for accounts that still exist after account replacement', () => {
    const db = new TestSqliteDatabase()
    try {
      db.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE accounts (id TEXT PRIMARY KEY);
        CREATE TABLE secret_services (
          id TEXT PRIMARY KEY,
          linked_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL
        );
        INSERT INTO accounts (id) VALUES ('keep'), ('remove');
        INSERT INTO secret_services (id, linked_account_id)
        VALUES ('service-keep', 'keep'), ('service-remove', 'remove');
      `)

      const links = captureLegacyServiceAccountLinks(db as any, {})
      db.exec(`
        DELETE FROM accounts;
        INSERT INTO accounts (id) VALUES ('keep');
      `)
      restoreLegacyServiceAccountLinks(db as any, links)

      expect(db.prepare(`
        SELECT id, linked_account_id
        FROM secret_services
        ORDER BY id
      `).all()).toEqual([
        { id: 'service-keep', linked_account_id: 'keep' },
        { id: 'service-remove', linked_account_id: null },
      ])
    } finally {
      db.close()
    }
  })

  it('does not carry current service links into a backup that supplies service data', () => {
    expect(hasServiceInfoBackupData({ secretServices: [] })).toBe(true)

    const db = new FakeDatabase()
    expect(captureLegacyServiceAccountLinks(db as any, { secretServices: [] })).toEqual([])
    expect(db.runCalls).toEqual([])
  })

  it('protects plaintext sensitive fields during import without changing ordinary fields', () => {
    const db = new FakeDatabase()
    const protectSecretValue = (value: string) => `encrypted:${value}`
    importServiceInfoBackupData(db as any, {
      secretFields: [
        { id: 'secret', service_id: 's1', field_name: 'API Key', field_value: 'plain', is_secret: 1 },
        { id: 'note', service_id: 's1', field_name: 'Region', field_value: 'ap-shanghai', is_secret: 0 },
      ],
    }, protectSecretValue)

    const fieldSql = 'INSERT INTO secret_fields (id, service_id, group_id, field_name, field_value, is_secret, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    expect(db.paramsBySql.get(fieldSql)?.map((params) => params[4])).toEqual([
      'encrypted:plain',
      'ap-shanghai',
    ])
  })

  it('round-trips v7 provider metadata while preserving encrypted field bytes', () => {
    const source = createBackupDatabase()
    const target = createBackupDatabase()
    const originalCiphertext = `${'1'.repeat(32)}:${'2'.repeat(32)}:cafe`

    try {
      source.exec(`
        INSERT INTO secret_services (id, name) VALUES ('provider', 'Provider');
        INSERT INTO secret_fields (id, service_id, field_name, field_value, is_secret, sort_order)
        VALUES
          ('base-url', 'provider', 'baseurl', 'https://api.example/v1', 0, 1),
          ('api-key', 'provider', 'apikey', '${originalCiphertext}', 1, 2);
        INSERT INTO model_provider_profiles (service_id, provider_id, base_url_field_id)
        VALUES ('provider', 'openai', 'base-url');
        INSERT INTO model_provider_key_metadata (field_id, purpose, manual_balance, sort_order)
        VALUES ('api-key', '生产环境', '$18.50', 1);
      `)

      const backup = readServiceInfoBackupData(source as any)
      target.transaction(() => importServiceInfoBackupData(target as any, backup, (value) => value))()

      expect(target.prepare(`
        SELECT service_id, provider_id, base_url_field_id
        FROM model_provider_profiles
      `).get()).toEqual({
        service_id: 'provider',
        provider_id: 'openai',
        base_url_field_id: 'base-url',
      })
      expect(target.prepare(`
        SELECT field_id, purpose, manual_balance, sort_order
        FROM model_provider_key_metadata
      `).get()).toEqual({
        field_id: 'api-key',
        purpose: '生产环境',
        manual_balance: '$18.50',
        sort_order: 1,
      })
      expect(target.prepare("SELECT field_value FROM secret_fields WHERE id = 'api-key'").get())
        .toEqual({ field_value: originalCiphertext })
    } finally {
      source.close()
      target.close()
    }
  })

  it('imports a v6 service backup without dropping legacy fields or retaining stale provider metadata', () => {
    const db = createBackupDatabase()

    try {
      db.exec(`
        INSERT INTO secret_services (id, name) VALUES ('current', 'Current');
        INSERT INTO secret_fields (id, service_id, field_name, field_value, is_secret)
        VALUES ('current-key', 'current', 'API Key', 'current-value', 1);
        INSERT INTO model_provider_profiles (service_id, provider_id)
        VALUES ('current', 'openai');
        INSERT INTO model_provider_key_metadata (field_id, purpose)
        VALUES ('current-key', 'stale');
      `)

      db.transaction(() => importServiceInfoBackupData(db as any, {
        secretGroups: [],
        secretServices: [{ id: 'legacy', name: 'Legacy Provider' }],
        secretFieldGroups: [],
        secretFields: [{
          id: 'legacy-key',
          service_id: 'legacy',
          field_name: 'apikey',
          field_value: 'legacy-value',
          is_secret: 0,
        }],
      }))()

      expect(db.prepare('SELECT service_id FROM model_provider_profiles').all()).toEqual([])
      expect(db.prepare('SELECT field_id FROM model_provider_key_metadata').all()).toEqual([])
      expect(db.prepare(`
        SELECT id, service_id, field_name, field_value, is_secret
        FROM secret_fields
      `).get()).toEqual({
        id: 'legacy-key',
        service_id: 'legacy',
        field_name: 'apikey',
        field_value: 'legacy-value',
        is_secret: 0,
      })
    } finally {
      db.close()
    }
  })
})
