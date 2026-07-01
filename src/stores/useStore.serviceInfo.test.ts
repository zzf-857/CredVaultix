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

describe('service info store slice', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('window', {
      electronAPI: {
        getServiceInfo: vi.fn().mockResolvedValue({ groups: [], services: [service] }),
        getServiceDetail: vi.fn().mockResolvedValue(detail),
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
})
