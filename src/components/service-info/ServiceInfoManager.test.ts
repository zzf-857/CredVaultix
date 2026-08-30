import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import BatchActionBar from './BatchActionBar'
import ServiceGroupList from './ServiceGroupList'
import serviceInfoManagerSource from './ServiceInfoManager.tsx?raw'

const service = {
  id: 'svc-1',
  group_id: null,
  linked_account_id: null,
  name: 'Tencent Cloud API',
  description: '腾讯云密钥',
  url: '',
  notes: '',
  is_favorite: 1,
  is_deleted: 0,
  deleted_at: null,
  sort_order: 1,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
  provider_id: 'tencent-hunyuan',
}

describe('ServiceInfoManager', () => {
  it('renders an ungrouped service list with service names and descriptions', () => {
    const html = renderToStaticMarkup(
      React.createElement(ServiceGroupList, {
        title: '未分组',
        services: [service],
        selectedServiceId: null,
        selectedServiceIds: [],
        draggingServiceId: null,
        onSelectService: () => undefined,
        onToggleServiceSelected: () => undefined,
        onToggleFavorite: () => undefined,
        onDropToGroup: () => undefined,
        onDragStart: () => undefined,
        onDragEnd: () => undefined,
        onDropBefore: () => undefined,
      })
    )

    expect(html).toContain('Tencent Cloud API')
    expect(html).toContain('未分组')
    expect(html).toContain('腾讯云密钥')
    expect(html).toContain('<img')
  })

  it('keeps the generic fixed-size fallback for an ordinary service', () => {
    const html = renderToStaticMarkup(
      React.createElement(ServiceGroupList, {
        title: '未分组',
        services: [{ ...service, id: 'ordinary-service', provider_id: null }],
        selectedServiceId: null,
        selectedServiceIds: [],
        draggingServiceId: null,
        onSelectService: () => undefined,
        onToggleServiceSelected: () => undefined,
        onToggleFavorite: () => undefined,
        onDropToGroup: () => undefined,
        onDragStart: () => undefined,
        onDragEnd: () => undefined,
        onDropBefore: () => undefined,
      })
    )

    expect(html).not.toContain('<img')
    expect(html).toContain('width:32px')
    expect(html).toContain('height:32px')
  })

  it('renders batch action labels for selected records', () => {
    const html = renderToStaticMarkup(
      React.createElement(BatchActionBar, {
        count: 2,
        onClear: () => undefined,
        onCreateGroup: () => undefined,
        onMoveToGroup: () => undefined,
        onUngroup: () => undefined,
      })
    )

    expect(html).toContain('已选择 2 项')
    expect(html).toContain('创建分组')
    expect(html).toContain('移入分组')
    expect(html).toContain('取消选择')
  })

  it('guards service and group mutations against duplicate submission and unsuccessful results', () => {
    expect(serviceInfoManagerSource).toContain('mutationLockRef.current')
    expect(serviceInfoManagerSource).toContain('assertMutationSucceeded(result')
    expect(serviceInfoManagerSource).toContain('assertMutationSucceeded(moveResult')
    expect(serviceInfoManagerSource).toContain('window.electronAPI.deleteSecretGroup')
    expect(serviceInfoManagerSource).toContain('window.electronAPI.reorderSecretServices')
  })

  it('reports refresh failures separately after a successful write', () => {
    expect(serviceInfoManagerSource).toContain("reloadAfterSuccessfulChange('服务已创建')")
    expect(serviceInfoManagerSource).toContain('但列表刷新失败')
    expect(serviceInfoManagerSource).toContain("severity: 'warning'")
    expect(serviceInfoManagerSource).toContain('pendingServiceGroup')
  })

  it('creates provider fields through the single transactional service command', () => {
    const createStart = serviceInfoManagerSource.indexOf('const createService =')
    const createEnd = serviceInfoManagerSource.indexOf('const openCreateGroupDialog =', createStart)
    const createHandler = serviceInfoManagerSource.slice(createStart, createEnd)

    expect(createHandler.match(/window\.electronAPI\.createSecretService\(/g)).toHaveLength(1)
    expect(createHandler).toContain('buildServiceFormSubmission(serviceForm, groupId)')
    expect(createHandler).not.toContain('createSecretField(')
    expect(serviceInfoManagerSource).not.toContain('buildServicePresetFields')
  })

  it('searches provider aliases and blocks navigation for a dirty service draft', () => {
    expect(serviceInfoManagerSource).toContain('getModelProviderById(service.provider_id)')
    expect(serviceInfoManagerSource).toContain('provider?.aliases')
    expect(serviceInfoManagerSource).toContain("setNavigationBlockReason(serviceFormDirty ? '新建服务内容尚未保存' : null)")
    expect(serviceInfoManagerSource).toContain('dirty={serviceFormDirty}')
    expect(serviceInfoManagerSource).toContain('|| serviceProviderInputPending')
    expect(serviceInfoManagerSource).toContain('onPendingProviderInputChange={setServiceProviderInputPending}')
  })
})
