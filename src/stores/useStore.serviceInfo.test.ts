import { beforeEach, describe, expect, it, vi } from 'vitest'

const service = {
  id: 'svc-1',
  group_id: null,
  linked_account_id: null,
  name: 'Tencent Cloud API',
  description: '',
  url: '',
  notes: '',
  is_favorite: 0,
  is_deleted: 0,
  deleted_at: null,
  sort_order: 1,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
}

const detail = {
  service,
  fieldGroups: [],
  fields: [
    {
      id: 'field-1',
      service_id: 'svc-1',
      group_id: null,
      field_name: 'SecretId',
      field_value: 'xxxxxx',
      is_secret: 1,
      sort_order: 1,
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
    },
  ],
}

const deletedService = {
  ...service,
  id: 'svc-deleted',
  name: 'Deleted service',
  is_deleted: 1,
  deleted_at: '2026-07-02T00:00:00.000Z',
}

describe('service info store slice', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('window', {
      electronAPI: {
        getServiceInfo: vi.fn().mockResolvedValue({ groups: [], services: [service] }),
        getServiceDetail: vi.fn().mockResolvedValue(detail),
        getDeletedSecretServices: vi.fn().mockResolvedValue([deletedService]),
        restoreSecretService: vi.fn().mockResolvedValue({ success: true }),
        hardDeleteSecretService: vi.fn().mockResolvedValue({ success: true }),
      },
    })
  })

  it('loads service list and keeps a selected service detail in sync', async () => {
    const { useStore } = await import('./useStore')

    await useStore.getState().loadServiceInfo()
    expect(useStore.getState().secretServices).toEqual([service])

    useStore.getState().setSelectedService('svc-1')
    await vi.waitFor(() => {
      expect(useStore.getState().selectedServiceDetail).toEqual(detail)
    })

    useStore.getState().setSelectedService(null)
    expect(useStore.getState().selectedServiceId).toBeNull()
    expect(useStore.getState().selectedServiceDetail).toBeNull()
  })

  it('refreshes the selected detail service from the latest list snapshot', async () => {
    const { useStore } = await import('./useStore')

    useStore.getState().setSelectedService('svc-1')
    await vi.waitFor(() => {
      expect(useStore.getState().selectedServiceDetail).toEqual(detail)
    })

    const favoriteService = { ...service, is_favorite: 1, updated_at: '2026-07-02T00:00:00.000Z' }
    vi.mocked(window.electronAPI.getServiceInfo).mockResolvedValueOnce({ groups: [], services: [favoriteService] })
    await useStore.getState().loadServiceInfo()

    expect(useStore.getState().selectedServiceDetail).toEqual({
      ...detail,
      service: favoriteService,
    })
  })

  it('toggles service and field multi-selection independently', async () => {
    const { useStore } = await import('./useStore')

    useStore.getState().toggleSelectedServiceId('svc-1')
    useStore.getState().toggleSelectedServiceId('svc-2')
    useStore.getState().toggleSelectedServiceId('svc-1')
    expect(useStore.getState().selectedServiceIds).toEqual(['svc-2'])

    useStore.getState().toggleSelectedFieldId('field-1')
    useStore.getState().toggleSelectedFieldId('field-1')
    expect(useStore.getState().selectedFieldIds).toEqual([])
  })

  it('keeps a selected service visible when loading its detail fails', async () => {
    vi.mocked(window.electronAPI.getServiceDetail).mockRejectedValueOnce(new Error('simulated read failure'))
    const { useStore } = await import('./useStore')

    useStore.getState().setSelectedService('svc-1')

    await vi.waitFor(() => {
      expect(useStore.getState()).toMatchObject({
        selectedServiceId: 'svc-1',
        selectedServiceDetail: null,
        serviceDetailLoadError: '读取服务详情失败：simulated read failure',
      })
    })
  })

  it('loads, restores, and permanently deletes service recycle-bin entries', async () => {
    const { useStore } = await import('./useStore')
    const api = window.electronAPI

    await useStore.getState().loadTrashServices()
    expect(useStore.getState().trashServices).toEqual([deletedService])

    vi.mocked(api.getDeletedSecretServices).mockResolvedValueOnce([])
    await useStore.getState().restoreSecretService(deletedService.id)
    expect(api.restoreSecretService).toHaveBeenCalledWith(deletedService.id)
    expect(useStore.getState().trashServices).toEqual([])

    vi.mocked(api.getDeletedSecretServices).mockResolvedValueOnce([])
    await useStore.getState().hardDeleteSecretService(deletedService.id)
    expect(api.hardDeleteSecretService).toHaveBeenCalledWith(deletedService.id)
  })
})
