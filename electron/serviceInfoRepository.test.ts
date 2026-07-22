import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TestSqliteDatabase } from './testSqlite'

const ipcHandlers = new Map<string, (...args: any[]) => any>()

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => 'C:/Temp/CredVaultix') },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      ipcHandlers.set(channel, handler)
    }),
  },
  shell: {
    openExternal: vi.fn(async () => undefined),
    openPath: vi.fn(async () => ''),
  },
}))

function createDatabase(serviceId: string, deleted: boolean) {
  const state = {
    service: {
      id: serviceId,
      name: serviceId,
      is_deleted: deleted ? 1 : 0,
      deleted_at: deleted ? '2026-07-01T00:00:00.000Z' : null,
      updated_at: '2026-07-01T00:00:00.000Z',
    } as Record<string, any> | null,
    fieldGroupCount: 1,
    fieldCount: 1,
  }

  const db = {
    prepare(sql: string) {
      if (sql.includes('SELECT * FROM secret_services WHERE is_deleted = 1')) {
        return { all: () => state.service?.is_deleted ? [{ ...state.service }] : [] }
      }
      if (sql.includes('SELECT is_deleted FROM secret_services')) {
        return { get: (id: string) => state.service?.id === id ? { is_deleted: state.service.is_deleted } : undefined }
      }
      if (sql.includes('UPDATE secret_services SET is_deleted = 0')) {
        return {
          run: (_updatedAt: string, id: string) => {
            const changed = state.service?.id === id && state.service.is_deleted === 1
            if (changed && state.service) {
              state.service.is_deleted = 0
              state.service.deleted_at = null
            }
            return { changes: changed ? 1 : 0 }
          },
        }
      }
      if (sql.includes('UPDATE secret_services SET is_deleted = 1')) {
        return {
          run: (_deletedAt: string, _updatedAt: string, id: string) => {
            const changed = state.service?.id === id && state.service.is_deleted === 0
            if (changed && state.service) {
              state.service.is_deleted = 1
              state.service.deleted_at = _deletedAt
            }
            return { changes: changed ? 1 : 0 }
          },
        }
      }
      if (sql.includes('DELETE FROM secret_fields')) {
        return { run: () => { state.fieldCount = 0 } }
      }
      if (sql.includes('DELETE FROM secret_field_groups')) {
        return { run: () => { state.fieldGroupCount = 0 } }
      }
      if (sql.includes('DELETE FROM secret_services')) {
        return { run: (id: string) => { if (state.service?.id === id) state.service = null } }
      }
      throw new Error(`Unexpected SQL in fake database: ${sql}`)
    },
    transaction(callback: () => void) {
      return () => callback()
    },
  }

  return { db, state }
}

function createServiceInfoDatabase() {
  const db = new TestSqliteDatabase()
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE secret_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_collapsed INTEGER DEFAULT 0,
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
      updated_at TEXT DEFAULT ''
    );

    INSERT INTO secret_groups (id, name, sort_order) VALUES
      ('group-1', 'Group 1', 1),
      ('group-2', 'Group 2', 2);
    INSERT INTO secret_services (id, group_id, name, sort_order) VALUES
      ('service-1', 'group-1', 'Service 1', 1),
      ('service-2', 'group-1', 'Service 2', 2);
    INSERT INTO secret_field_groups (id, service_id, name, sort_order) VALUES
      ('field-group-1', 'service-1', 'Fields 1', 1),
      ('field-group-2', 'service-2', 'Fields 2', 1);
    INSERT INTO secret_fields (id, service_id, group_id, field_name, sort_order) VALUES
      ('field-1', 'service-1', NULL, 'Field 1', 1),
      ('field-2', 'service-1', NULL, 'Field 2', 2),
      ('field-3', 'service-2', NULL, 'Field 3', 1);
  `)
  return db
}

describe('service information IPC lifecycle', () => {
  beforeEach(() => {
    ipcHandlers.clear()
    vi.resetModules()
  })

  it('restores and permanently deletes only services already in the recycle bin', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const { db, state } = createDatabase('deleted-service', true)
    registerServiceInfoIpc(db as any)

    const getDeleted = ipcHandlers.get('serviceInfo:getDeletedServices')!
    const restore = ipcHandlers.get('serviceInfo:restoreService')!
    const hardDelete = ipcHandlers.get('serviceInfo:hardDeleteService')!

    expect(getDeleted()).toHaveLength(1)
    expect(restore(undefined, 'deleted-service')).toEqual({ success: true })
    expect(getDeleted()).toHaveLength(0)
    expect(restore(undefined, 'deleted-service')).toEqual({ success: false })
    expect(hardDelete(undefined, 'deleted-service')).toEqual({ success: false })
    expect(state.fieldCount).toBe(1)

    state.service!.is_deleted = 1
    state.service!.deleted_at = '2026-07-02'
    expect(hardDelete(undefined, 'deleted-service')).toEqual({ success: true })
    expect(state.service).toBeNull()
    expect(state.fieldGroupCount).toBe(0)
    expect(state.fieldCount).toBe(0)
  })

  it('moves an active service to the recycle bin only once', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const { db } = createDatabase('active-service', false)
    registerServiceInfoIpc(db as any)
    const deleteService = ipcHandlers.get('serviceInfo:deleteService')!
    const restore = ipcHandlers.get('serviceInfo:restoreService')!

    expect(deleteService(undefined, 'active-service')).toEqual({ success: true })
    expect(deleteService(undefined, 'active-service')).toEqual({ success: false })
    expect(restore(undefined, 'active-service')).toEqual({ success: true })
  })

  it('switches every service handler to the imported database connection', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const originalDb = createDatabase('original-service', true)
    const importedDb = createDatabase('imported-service', true)
    const updateDatabase = registerServiceInfoIpc(originalDb.db as any)
    const getDeleted = ipcHandlers.get('serviceInfo:getDeletedServices')!

    expect(getDeleted().map((row: { id: string }) => row.id)).toEqual(['original-service'])
    updateDatabase(importedDb.db as any)
    expect(getDeleted().map((row: { id: string }) => row.id)).toEqual(['imported-service'])
  })

  it('opens bare web addresses as HTTPS and rejects non-web schemes', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const { db } = createDatabase('service', false)
    registerServiceInfoIpc(db as any)
    const openExternal = ipcHandlers.get('app:openExternal')!

    await expect(openExternal(undefined, 'example.com/path')).resolves.toEqual({ success: true })
    await expect(openExternal(undefined, 'file:///C:/secret.txt')).resolves.toEqual({
      success: false,
      error: '只允许打开 HTTP 或 HTTPS 地址',
    })
  })

  it('returns false when a single-record update or delete targets a stale id', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const db = createServiceInfoDatabase()

    try {
      registerServiceInfoIpc(db as any)

      expect(ipcHandlers.get('serviceInfo:updateGroup')!(undefined, 'missing', { name: 'Renamed' }))
        .toEqual({ success: false })
      expect(ipcHandlers.get('serviceInfo:deleteGroup')!(undefined, 'missing')).toEqual({ success: false })
      expect(ipcHandlers.get('serviceInfo:updateService')!(undefined, 'missing', { name: 'Renamed' }))
        .toEqual({ success: false })
      expect(ipcHandlers.get('serviceInfo:updateFieldGroup')!(undefined, 'missing', { name: 'Renamed' }))
        .toEqual({ success: false })
      expect(ipcHandlers.get('serviceInfo:deleteFieldGroup')!(undefined, 'missing')).toEqual({ success: false })
      expect(ipcHandlers.get('serviceInfo:updateField')!(undefined, 'missing', { fieldName: 'Renamed' }))
        .toEqual({ success: false })
      expect(ipcHandlers.get('serviceInfo:deleteField')!(undefined, 'missing')).toEqual({ success: false })
    } finally {
      db.close()
    }
  })

  it('rejects stale batch ids, mixed field owners, and a field group from another service without partial writes', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const db = createServiceInfoDatabase()

    try {
      registerServiceInfoIpc(db as any)
      const moveServices = ipcHandlers.get('serviceInfo:moveServices')!
      const reorderServices = ipcHandlers.get('serviceInfo:reorderServices')!
      const moveFields = ipcHandlers.get('serviceInfo:moveFields')!
      const reorderFields = ipcHandlers.get('serviceInfo:reorderFields')!

      expect(moveServices(undefined, { ids: ['service-1', 'missing'], groupId: 'group-2' }))
        .toEqual({ success: false })
      expect(reorderServices(undefined, { orderedIds: ['service-1', 'missing'], groupId: 'group-2' }))
        .toEqual({ success: false })
      expect(db.prepare("SELECT group_id, sort_order FROM secret_services WHERE id = 'service-1'").get())
        .toEqual({ group_id: 'group-1', sort_order: 1 })

      expect(moveFields(undefined, { ids: ['field-1', 'missing'], groupId: 'field-group-1' }))
        .toEqual({ success: false })
      expect(moveFields(undefined, { ids: ['field-1', 'field-3'], groupId: 'field-group-1' }))
        .toEqual({ success: false })
      expect(reorderFields(undefined, { orderedIds: ['field-1', 'field-2'], groupId: 'field-group-2' }))
        .toEqual({ success: false })
      expect(db.prepare("SELECT group_id, sort_order FROM secret_fields WHERE id = 'field-1'").get())
        .toEqual({ group_id: null, sort_order: 1 })
      expect(db.prepare("SELECT group_id, sort_order FROM secret_fields WHERE id = 'field-2'").get())
        .toEqual({ group_id: null, sort_order: 2 })
    } finally {
      db.close()
    }
  })

  it('rolls back every service in a batch when a later database update fails', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const db = createServiceInfoDatabase()

    try {
      registerServiceInfoIpc(db as any)
      db.exec(`
        CREATE TRIGGER reject_second_service_move
        BEFORE UPDATE OF group_id ON secret_services
        WHEN NEW.id = 'service-2'
        BEGIN
          SELECT RAISE(ABORT, 'simulated batch failure');
        END;
      `)

      const moveServices = ipcHandlers.get('serviceInfo:moveServices')!
      expect(() => moveServices(undefined, {
        ids: ['service-1', 'service-2'],
        groupId: 'group-2',
      })).toThrow(/simulated batch failure/)

      expect(db.prepare('SELECT id, group_id, sort_order FROM secret_services ORDER BY id').all()).toEqual([
        { id: 'service-1', group_id: 'group-1', sort_order: 1 },
        { id: 'service-2', group_id: 'group-1', sort_order: 2 },
      ])
    } finally {
      db.close()
    }
  })
})
