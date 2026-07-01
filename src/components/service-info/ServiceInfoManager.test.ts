import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import BatchActionBar from './BatchActionBar'
import ServiceGroupList from './ServiceGroupList'

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
      })
    )

    expect(html).toContain('Tencent Cloud API')
    expect(html).toContain('未分组')
    expect(html).toContain('腾讯云密钥')
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
})
