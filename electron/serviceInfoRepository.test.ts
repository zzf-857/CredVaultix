import { beforeEach, describe, expect, it, vi } from 'vitest'

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
            if (state.service?.id === id) {
              state.service.is_deleted = 0
              state.service.deleted_at = null
            }
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
    expect(hardDelete(undefined, 'deleted-service')).toEqual({ success: false })
    expect(state.fieldCount).toBe(1)

    state.service!.is_deleted = 1
    state.service!.deleted_at = '2026-07-02'
    expect(hardDelete(undefined, 'deleted-service')).toEqual({ success: true })
    expect(state.service).toBeNull()
    expect(state.fieldGroupCount).toBe(0)
    expect(state.fieldCount).toBe(0)
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
})
