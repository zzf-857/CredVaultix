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
      if (sql.includes('FROM secret_services AS service') && sql.includes('service.is_deleted = 1')) {
        return { all: () => state.service?.is_deleted ? [{ ...state.service, provider_id: null }] : [] }
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

  it('does not rewrite undecryptable service field ciphertext during metadata-only edits', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const db = createServiceInfoDatabase()
    const ciphertext = `${'a'.repeat(32)}:${'b'.repeat(32)}:cafe`

    try {
      db.prepare(`
        UPDATE secret_fields
        SET field_name = 'Old name', field_value = ?, is_secret = 1
        WHERE id = 'field-1'
      `).run(ciphertext)
      registerServiceInfoIpc(db as any)
      const updateField = ipcHandlers.get('serviceInfo:updateField')!

      expect(updateField(undefined, 'field-1', {
        fieldName: 'New name',
        fieldValue: ciphertext,
        isSecret: true,
      })).toEqual({ success: true })
      expect(db.prepare(`
        SELECT field_name, field_value, is_secret
        FROM secret_fields WHERE id = 'field-1'
      `).get()).toEqual({
        field_name: 'New name',
        field_value: ciphertext,
        is_secret: 1,
      })
    } finally {
      db.close()
    }
  })

  it('requires a replacement value before changing protection on an undecryptable service field', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const db = createServiceInfoDatabase()
    const ciphertext = `${'a'.repeat(32)}:${'b'.repeat(32)}:cafe`

    try {
      db.prepare(`
        UPDATE secret_fields SET field_value = ?, is_secret = 1 WHERE id = 'field-1'
      `).run(ciphertext)
      registerServiceInfoIpc(db as any)
      const updateField = ipcHandlers.get('serviceInfo:updateField')!

      expect(() => updateField(undefined, 'field-1', {
        fieldValue: ciphertext,
        isSecret: false,
      })).toThrow(/无法解密/)
      expect(db.prepare(`
        SELECT field_value, is_secret FROM secret_fields WHERE id = 'field-1'
      `).get()).toEqual({ field_value: ciphertext, is_secret: 1 })

      expect(updateField(undefined, 'field-1', {
        fieldValue: 'replacement',
        isSecret: true,
      })).toEqual({ success: true })
      const replaced = db.prepare(`
        SELECT field_value, is_secret FROM secret_fields WHERE id = 'field-1'
      `).get() as { field_value: string; is_secret: number }
      expect(replaced.is_secret).toBe(1)
      expect(replaced.field_value).not.toBe(ciphertext)
      expect(replaced.field_value).not.toContain('replacement')

      expect(updateField(undefined, 'field-1', { isSecret: false })).toEqual({ success: true })
      expect(db.prepare(`
        SELECT field_value, is_secret FROM secret_fields WHERE id = 'field-1'
      `).get()).toEqual({ field_value: 'replacement', is_secret: 0 })
    } finally {
      db.close()
    }
  })

  it('appends a service to the end of its new group but keeps sort order when the group is unchanged', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const db = createServiceInfoDatabase()

    try {
      db.exec("INSERT INTO secret_services (id, group_id, name, sort_order) VALUES ('service-3', 'group-2', 'Service 3', 5)")
      registerServiceInfoIpc(db as any)
      const updateService = ipcHandlers.get('serviceInfo:updateService')!

      expect(updateService(undefined, 'service-1', { groupId: 'group-2' })).toEqual({ success: true })
      expect(db.prepare("SELECT group_id, sort_order FROM secret_services WHERE id = 'service-1'").get())
        .toEqual({ group_id: 'group-2', sort_order: 6 })

      expect(updateService(undefined, 'service-2', { name: '新名字', groupId: 'group-1' })).toEqual({ success: true })
      expect(db.prepare("SELECT group_id, name, sort_order FROM secret_services WHERE id = 'service-2'").get())
        .toEqual({ group_id: 'group-1', name: '新名字', sort_order: 2 })
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

  it('creates a model provider, Base URL, and multiple encrypted keys in one transaction', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const db = createServiceInfoDatabase()

    try {
      registerServiceInfoIpc(db as any)
      const createService = ipcHandlers.get('serviceInfo:createService')!
      const getDetail = ipcHandlers.get('serviceInfo:getDetail')!
      const getAll = ipcHandlers.get('serviceInfo:getAll')!

      expect(createService(undefined, {
        id: 'provider-service',
        name: 'OpenAI',
        providerProfile: {
          providerId: 'openai',
          baseUrl: {
            fieldId: 'provider-base-url',
            fieldValue: 'https://api.openai.com/v1',
          },
          keys: [
            {
              fieldId: 'provider-key-production',
              fieldValue: 'sk-production',
              purpose: '生产环境',
              manualBalance: '$20',
              sortOrder: 1,
            },
            {
              fieldId: 'provider-key-development',
              fieldName: 'Development Key',
              fieldValue: 'sk-development',
              purpose: '开发测试',
              manualBalance: '$5',
              sortOrder: 2,
            },
          ],
          detachKeyIds: [],
        },
      })).toEqual({ id: 'provider-service' })

      const rawFields = db.prepare(`
        SELECT id, field_name, field_value, is_secret, sort_order
        FROM secret_fields
        WHERE service_id = 'provider-service'
        ORDER BY id
      `).all() as Array<Record<string, any>>
      expect(rawFields).toHaveLength(3)
      expect(rawFields.find((field) => field.id === 'provider-base-url')).toMatchObject({
        field_name: 'Base URL',
        field_value: 'https://api.openai.com/v1',
        is_secret: 0,
      })
      for (const keyId of ['provider-key-production', 'provider-key-development']) {
        const key = rawFields.find((field) => field.id === keyId)!
        expect(key.is_secret).toBe(1)
        expect(key.field_value).not.toContain(keyId.endsWith('production') ? 'sk-production' : 'sk-development')
      }

      expect(getDetail(undefined, 'provider-service').modelProvider).toEqual({
        providerId: 'openai',
        baseUrlFieldId: 'provider-base-url',
        keys: [
          { fieldId: 'provider-key-production', purpose: '生产环境', manualBalance: '$20', sortOrder: 1 },
          { fieldId: 'provider-key-development', purpose: '开发测试', manualBalance: '$5', sortOrder: 2 },
        ],
      })
      expect(getAll().services.find((service: any) => service.id === 'provider-service').provider_id)
        .toBe('openai')
    } finally {
      db.close()
    }
  })

  it('claims existing fields without rewriting ciphertext and detaches metadata without deleting fields', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const db = createServiceInfoDatabase()
    const undecryptableCiphertext = `${'a'.repeat(32)}:${'b'.repeat(32)}:cafe`

    try {
      db.prepare(`
        UPDATE secret_fields
        SET field_name = 'legacy_apikey', field_value = ?, is_secret = 1,
            group_id = 'field-group-1', sort_order = 37, updated_at = 'legacy-timestamp'
        WHERE id = 'field-1'
      `).run(undecryptableCiphertext)
      db.prepare(`
        UPDATE secret_fields
        SET field_name = 'legacy_baseurl', field_value = 'https://legacy.example/v1', is_secret = 0
        WHERE id = 'field-2'
      `).run()

      registerServiceInfoIpc(db as any)
      const updateService = ipcHandlers.get('serviceInfo:updateService')!
      expect(updateService(undefined, 'service-1', {
        providerProfile: {
          providerId: 'custom',
          baseUrl: { fieldId: 'field-2' },
          keys: [{
            fieldId: 'field-1',
            purpose: '旧生产 Key',
            manualBalance: '未知',
            sortOrder: 1,
          }],
          detachKeyIds: [],
        },
      })).toEqual({ success: true })

      expect(db.prepare(`
        SELECT field_name, field_value, is_secret, group_id, sort_order, updated_at
        FROM secret_fields WHERE id = 'field-1'
      `).get()).toEqual({
        field_name: 'legacy_apikey',
        field_value: undecryptableCiphertext,
        is_secret: 1,
        group_id: 'field-group-1',
        sort_order: 37,
        updated_at: 'legacy-timestamp',
      })

      expect(updateService(undefined, 'service-1', {
        providerProfile: {
          providerId: 'custom',
          baseUrl: { fieldId: 'field-2' },
          keys: [],
          detachKeyIds: ['field-1'],
        },
      })).toEqual({ success: true })
      expect(db.prepare("SELECT field_value FROM secret_fields WHERE id = 'field-1'").get())
        .toEqual({ field_value: undecryptableCiphertext })
      expect(db.prepare("SELECT field_id FROM model_provider_key_metadata WHERE field_id = 'field-1'").get())
        .toBeUndefined()

      expect(updateService(undefined, 'service-1', { providerProfile: null })).toEqual({ success: true })
      expect(db.prepare("SELECT service_id FROM model_provider_profiles WHERE service_id = 'service-1'").get())
        .toBeUndefined()
      expect(db.prepare("SELECT COUNT(*) AS count FROM secret_fields WHERE service_id = 'service-1'").get())
        .toEqual({ count: 2 })
    } finally {
      db.close()
    }
  })

  it('protects undecryptable provider keys from managed-field rewrites', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const db = createServiceInfoDatabase()
    const undecryptableCiphertext = `${'a'.repeat(32)}:${'b'.repeat(32)}:cafe`

    try {
      db.prepare(`
        UPDATE secret_fields
        SET field_name = 'Old API Key', field_value = ?, is_secret = 1
        WHERE id = 'field-1'
      `).run(undecryptableCiphertext)

      registerServiceInfoIpc(db as any)
      const updateService = ipcHandlers.get('serviceInfo:updateService')!

      expect(updateService(undefined, 'service-1', {
        providerProfile: {
          providerId: 'custom',
          baseUrl: null,
          keys: [{
            fieldId: 'field-1',
            fieldName: 'Renamed API Key',
            fieldValue: undecryptableCiphertext,
            isSecret: true,
            purpose: '生产环境',
            manualBalance: '$10',
            sortOrder: 1,
          }],
          detachKeyIds: [],
        },
      })).toEqual({ success: true })
      expect(db.prepare(`
        SELECT field_name, field_value, is_secret
        FROM secret_fields WHERE id = 'field-1'
      `).get()).toEqual({
        field_name: 'Renamed API Key',
        field_value: undecryptableCiphertext,
        is_secret: 1,
      })

      expect(() => updateService(undefined, 'service-1', {
        providerProfile: {
          providerId: 'custom',
          baseUrl: null,
          keys: [{
            fieldId: 'field-1',
            isSecret: false,
            purpose: '不得提交',
            manualBalance: '$0',
            sortOrder: 1,
          }],
          detachKeyIds: [],
        },
      })).toThrow(/无法解密/)
      expect(db.prepare(`
        SELECT field_value, is_secret FROM secret_fields WHERE id = 'field-1'
      `).get()).toEqual({ field_value: undecryptableCiphertext, is_secret: 1 })
      expect(db.prepare(`
        SELECT purpose, manual_balance
        FROM model_provider_key_metadata WHERE field_id = 'field-1'
      `).get()).toEqual({ purpose: '生产环境', manual_balance: '$10' })

      expect(updateService(undefined, 'service-1', {
        providerProfile: {
          providerId: 'custom',
          baseUrl: null,
          keys: [{
            fieldId: 'field-1',
            fieldValue: 'replacement-provider-key',
            isSecret: false,
            purpose: '已替换',
            manualBalance: '$20',
            sortOrder: 1,
          }],
          detachKeyIds: [],
        },
      })).toEqual({ success: true })
      expect(db.prepare(`
        SELECT field_value, is_secret FROM secret_fields WHERE id = 'field-1'
      `).get()).toEqual({ field_value: 'replacement-provider-key', is_secret: 0 })
    } finally {
      db.close()
    }
  })

  it('rolls back service and field creation when provider metadata insertion fails', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const db = createServiceInfoDatabase()

    try {
      db.exec(`
        CREATE TRIGGER reject_provider_key_metadata
        BEFORE INSERT ON model_provider_key_metadata
        BEGIN
          SELECT RAISE(ABORT, 'simulated provider metadata failure');
        END;
      `)
      registerServiceInfoIpc(db as any)
      const createService = ipcHandlers.get('serviceInfo:createService')!

      expect(() => createService(undefined, {
        id: 'rolled-back-provider',
        name: 'Rollback Provider',
        providerProfile: {
          providerId: 'custom',
          baseUrl: { fieldId: 'rolled-back-base', fieldValue: 'https://rollback.test' },
          keys: [{
            fieldId: 'rolled-back-key',
            fieldValue: 'should-not-survive',
            purpose: '',
            manualBalance: '',
            sortOrder: 1,
          }],
          detachKeyIds: [],
        },
      })).toThrow(/simulated provider metadata failure/)

      expect(db.prepare("SELECT id FROM secret_services WHERE id = 'rolled-back-provider'").get()).toBeUndefined()
      expect(db.prepare("SELECT id FROM secret_fields WHERE service_id = 'rolled-back-provider'").all()).toEqual([])
      expect(db.prepare("SELECT service_id FROM model_provider_profiles WHERE service_id = 'rolled-back-provider'").get())
        .toBeUndefined()
    } finally {
      db.close()
    }
  })

  it('rejects provider field ids owned by another service and rolls back the service update', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const db = createServiceInfoDatabase()

    try {
      registerServiceInfoIpc(db as any)
      const updateService = ipcHandlers.get('serviceInfo:updateService')!
      expect(() => updateService(undefined, 'service-1', {
        name: 'Should Roll Back',
        providerProfile: {
          providerId: 'custom',
          baseUrl: null,
          keys: [{
            fieldId: 'field-3',
            purpose: '',
            manualBalance: '',
            sortOrder: 1,
          }],
          detachKeyIds: [],
        },
      })).toThrow(/does not belong to service/)
      expect(db.prepare("SELECT name FROM secret_services WHERE id = 'service-1'").get())
        .toEqual({ name: 'Service 1' })
      expect(db.prepare("SELECT service_id FROM model_provider_profiles WHERE service_id = 'service-1'").get())
        .toBeUndefined()
    } finally {
      db.close()
    }
  })

  it('rejects a persisted provider Key reused as Base URL and rolls back every update', async () => {
    const { registerServiceInfoIpc } = await import('./serviceInfoRepository')
    const db = createServiceInfoDatabase()

    try {
      registerServiceInfoIpc(db as any)
      const updateService = ipcHandlers.get('serviceInfo:updateService')!

      expect(updateService(undefined, 'service-1', {
        providerProfile: {
          providerId: 'openai',
          baseUrl: null,
          keys: [{
            fieldId: 'field-1',
            purpose: '生产环境',
            manualBalance: '$10',
            sortOrder: 1,
          }],
          detachKeyIds: [],
        },
      })).toEqual({ success: true })

      const fieldBefore = db.prepare(`
        SELECT field_name, field_value, is_secret, updated_at
        FROM secret_fields WHERE id = 'field-1'
      `).get()
      const profileBefore = db.prepare(`
        SELECT provider_id, base_url_field_id, updated_at
        FROM model_provider_profiles WHERE service_id = 'service-1'
      `).get()
      const keyMetadataBefore = db.prepare(`
        SELECT purpose, manual_balance, sort_order, updated_at
        FROM model_provider_key_metadata WHERE field_id = 'field-1'
      `).get()

      expect(() => updateService(undefined, 'service-1', {
        name: 'Should Roll Back',
        providerProfile: {
          providerId: 'anthropic',
          baseUrl: {
            fieldId: 'field-1',
            fieldName: 'Base URL',
            fieldValue: 'https://api.anthropic.com',
          },
          keys: [],
          detachKeyIds: [],
        },
      })).toThrow(/Base URL field cannot also be used as an API key/)

      expect(db.prepare("SELECT name FROM secret_services WHERE id = 'service-1'").get())
        .toEqual({ name: 'Service 1' })
      expect(db.prepare(`
        SELECT field_name, field_value, is_secret, updated_at
        FROM secret_fields WHERE id = 'field-1'
      `).get()).toEqual(fieldBefore)
      expect(db.prepare(`
        SELECT provider_id, base_url_field_id, updated_at
        FROM model_provider_profiles WHERE service_id = 'service-1'
      `).get()).toEqual(profileBefore)
      expect(db.prepare(`
        SELECT purpose, manual_balance, sort_order, updated_at
        FROM model_provider_key_metadata WHERE field_id = 'field-1'
      `).get()).toEqual(keyMetadataBefore)
    } finally {
      db.close()
    }
  })
})
