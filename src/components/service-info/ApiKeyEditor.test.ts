import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ApiKeyEditor from './ApiKeyEditor'
import { createServiceApiKeyDraft, type ServiceApiKeyDraft } from './serviceForm'

function renderEditor(keys: ServiceApiKeyDraft[], keyErrors?: Record<string, string>) {
  return renderToStaticMarkup(React.createElement(ApiKeyEditor, {
    keys,
    detachKeyIds: [],
    detachedApiKeys: [],
    keyErrors,
    onChange: () => undefined,
  }))
}

describe('ApiKeyEditor', () => {
  it('keeps API Key first and purpose and balance visible outside advanced settings', () => {
    const key = { ...createServiceApiKeyDraft('key-1'), purpose: '生产推理', manualBalance: '$12' }
    const html = renderEditor([key])

    expect(html.indexOf('API Key')).toBeLessThan(html.indexOf('用途备注'))
    expect(html.indexOf('用途备注')).toBeLessThan(html.indexOf('高级设置'))
    expect(html.indexOf('余额备注')).toBeLessThan(html.indexOf('高级设置'))
    expect(html).toContain('生产推理')
    expect(html).toContain('$12')
  })

  it('renders a parent-provided inline error for an empty new or existing key', () => {
    const newKey = createServiceApiKeyDraft('new-key')
    const existingKey: ServiceApiKeyDraft = {
      ...createServiceApiKeyDraft('existing-key'),
      originalLabel: 'Existing Key',
      originalValue: 'previous-value',
      originalIsSecret: true,
      value: '',
    }
    const html = renderEditor(
      [newKey, existingKey],
      { 'new-key': '请填写新 Key', 'existing-key': '已有 Key 不能为空，请解除关联' }
    )

    expect(html).toContain('请填写新 Key')
    expect(html).toContain('已有 Key 不能为空，请解除关联')
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(2)
  })

  it('keeps field naming and plaintext migration diagnostics in advanced settings', () => {
    const plaintextKey: ServiceApiKeyDraft = {
      ...createServiceApiKeyDraft('legacy-key'),
      label: 'Legacy Key',
      value: 'legacy-value',
      originalLabel: 'Legacy Key',
      originalValue: 'legacy-value',
      originalIsSecret: false,
      isSecret: false,
    }
    const html = renderEditor([plaintextKey])

    expect(html).toContain('高级设置')
    expect(html.indexOf('高级设置')).toBeLessThan(html.indexOf('Key 名称'))
    expect(html.indexOf('高级设置')).toBeLessThan(html.indexOf('这是历史明文字段'))
  })
})
