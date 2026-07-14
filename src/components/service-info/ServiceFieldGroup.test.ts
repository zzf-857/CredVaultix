import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ServiceFieldGroup from './ServiceFieldGroup'

const field = {
  id: 'field-1',
  service_id: 'svc-1',
  group_id: 'fg-1',
  field_name: 'SecretId',
  field_value: 'should-not-render',
  is_secret: 1,
  sort_order: 1,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
}

describe('ServiceFieldGroup', () => {
  it('renders grouped sensitive fields hidden by default', () => {
    const html = renderToStaticMarkup(
      React.createElement(ServiceFieldGroup, {
        title: '腾讯云',
        color: '#a8c7fa',
        fields: [field],
        selectedIds: [],
        draggingFieldId: null,
        onToggleSelected: () => undefined,
        onEditField: () => undefined,
        onDeleteField: () => undefined,
        onToggleCollapsed: () => undefined,
        onRenameGroup: () => undefined,
        onDeleteGroup: () => undefined,
        onDropToGroup: () => undefined,
        onDragStart: () => undefined,
        onDragEnd: () => undefined,
        onDropBefore: () => undefined,
      })
    )

    expect(html).toContain('腾讯云')
    expect(html).toContain('SecretId')
    expect(html).toContain('••••••••')
    expect(html).not.toContain('should-not-render')
  })
})
