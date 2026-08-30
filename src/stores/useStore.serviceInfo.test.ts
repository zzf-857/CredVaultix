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
  modelProvider: null,
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

  it('invalidates stale detail and field selection when refreshing the selected service fails', async () => {
    const { useStore } = await import('./useStore')

    useStore.getState().setSelectedService('svc-1')
    await vi.waitFor(() => {
      expect(useStore.getState().selectedServiceDetail).toEqual(detail)
    })
    useStore.getState().toggleSelectedFieldId('field-1')
    expect(useStore.getState().selectedFieldIds).toEqual(['field-1'])

    vi.mocked(window.electronAPI.getServiceDetail).mockRejectedValueOnce(new Error('simulated refresh failure'))
    await expect(useStore.getState().loadServiceDetail('svc-1')).rejects.toThrow('simulated refresh failure')

    expect(useStore.getState()).toMatchObject({
      selectedServiceId: 'svc-1',
      selectedServiceDetail: null,
      selectedFieldIds: [],
      serviceDetailLoadError: '读取服务详情失败：simulated refresh failure',
    })
  })

  it('ignores a detail response after the service is no longer selected', async () => {
    let resolveDetail!: (value: typeof detail) => void
    const pendingDetail = new Promise<typeof detail>((resolve) => {
      resolveDetail = resolve
    })
    vi.mocked(window.electronAPI.getServiceDetail).mockReturnValueOnce(pendingDetail)
    const { useStore } = await import('./useStore')

    useStore.getState().setSelectedService('svc-1')
    expect(useStore.getState().selectedServiceId).toBe('svc-1')
    useStore.getState().setSelectedService(null)
    resolveDetail(detail)
    await pendingDetail

    await vi.waitFor(() => {
      expect(useStore.getState()).toMatchObject({
        selectedServiceId: null,
        selectedServiceDetail: null,
      })
    })
  })

  it('invalidates and reloads a selected service detail after importing the same service id', async () => {
    const importedService = {
      ...service,
      name: 'Imported OpenAI API',
      updated_at: '2026-07-03T00:00:00.000Z',
    }
    const importedDetail = {
      service: importedService,
      fieldGroups: [],
      modelProvider: {
        providerId: 'openai',
        baseUrlFieldId: null,
        keys: [{ fieldId: 'field-imported', purpose: 'Production', manualBalance: '$20', sortOrder: 1 }],
      },
      fields: [{
        ...detail.fields[0],
        id: 'field-imported',
        field_name: 'API Key',
        field_value: 'imported-api-key',
        updated_at: '2026-07-03T00:00:00.000Z',
      }],
    }
    const api = window.electronAPI
    vi.mocked(api.getServiceInfo).mockResolvedValueOnce({ groups: [], services: [importedService] })
    vi.mocked(api.getServiceDetail)
      .mockResolvedValueOnce(detail)
      .mockImplementationOnce(async () => {
        expect(useStore.getState().selectedServiceDetail).toBeNull()
        return importedDetail
      })
    Object.assign(api, {
      importDatabase: vi.fn().mockResolvedValue({ success: true }),
      getTotpAccounts: vi.fn().mockResolvedValue([]),
      getAccounts: vi.fn().mockResolvedValue([]),
      getAppPreferences: vi.fn().mockResolvedValue({ accountsPinnedIds: [], accountsCustomOrder: [] }),
    })
    const { useStore } = await import('./useStore')

    useStore.getState().setSelectedService(service.id)
    await vi.waitFor(() => {
      expect(useStore.getState().selectedServiceDetail).toEqual(detail)
    })

    const result = await useStore.getState().importDatabase()

    expect(result).toMatchObject({ success: true, refreshFailed: false })
    expect(api.getServiceDetail).toHaveBeenCalledTimes(2)
    expect(useStore.getState().selectedServiceDetail).toEqual(importedDetail)
  })

  it('keeps stale selected details invalidated when their post-import reload fails', async () => {
    const api = window.electronAPI
    vi.mocked(api.getServiceDetail)
      .mockResolvedValueOnce(detail)
      .mockRejectedValueOnce(new Error('simulated imported detail failure'))
    Object.assign(api, {
      importDatabase: vi.fn().mockResolvedValue({ success: true }),
      getTotpAccounts: vi.fn().mockResolvedValue([]),
      getAccounts: vi.fn().mockResolvedValue([]),
      getAppPreferences: vi.fn().mockResolvedValue({ accountsPinnedIds: [], accountsCustomOrder: [] }),
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { useStore } = await import('./useStore')

    useStore.getState().setSelectedService(service.id)
    await vi.waitFor(() => {
      expect(useStore.getState().selectedServiceDetail).toEqual(detail)
    })

    const result = await useStore.getState().importDatabase()

    expect(result).toMatchObject({ success: true, refreshFailed: true })
    expect(useStore.getState()).toMatchObject({
      selectedServiceId: service.id,
      selectedServiceDetail: null,
      serviceDetailLoadError: '读取服务详情失败：simulated imported detail failure',
    })
    consoleError.mockRestore()
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
