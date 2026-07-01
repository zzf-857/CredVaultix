import { describe, expect, it } from 'vitest'
import {
  SERVICE_INFO_BACKUP_VERSION,
  clearServiceInfoBackupTables,
  importServiceInfoBackupData,
  readServiceInfoBackupData,
} from './serviceInfoBackup'

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

describe('serviceInfoBackup', () => {
  it('uses the backup version that includes service information tables', () => {
    expect(SERVICE_INFO_BACKUP_VERSION).toBe(5)
  })

  it('reads all service information tables into the JSON payload', () => {
    const db = new FakeDatabase()
    db.allRows.set('SELECT * FROM secret_groups', [{ id: 'g1' }])
    db.allRows.set('SELECT * FROM secret_services', [{ id: 's1' }])
    db.allRows.set('SELECT * FROM secret_field_groups', [{ id: 'fg1' }])
    db.allRows.set('SELECT * FROM secret_fields', [{ id: 'f1' }])

    expect(readServiceInfoBackupData(db as any)).toEqual({
      secretGroups: [{ id: 'g1' }],
      secretServices: [{ id: 's1' }],
      secretFieldGroups: [{ id: 'fg1' }],
      secretFields: [{ id: 'f1' }],
    })
  })

  it('clears service information tables from children to parents before import', () => {
    const db = new FakeDatabase()
    clearServiceInfoBackupTables(db as any)

    expect(db.runCalls).toEqual([
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
    })

    const serviceSql = `
    INSERT INTO secret_services (id, group_id, linked_account_id, name, description, url, notes, is_favorite, is_deleted, deleted_at, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    const fieldSql = 'INSERT INTO secret_fields (id, service_id, group_id, field_name, field_value, is_secret, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'

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
  })

  it('leaves existing service information untouched for legacy backups without service arrays', () => {
    const db = new FakeDatabase()

    importServiceInfoBackupData(db as any, {})

    expect(db.runCalls).toEqual([])
  })
})
