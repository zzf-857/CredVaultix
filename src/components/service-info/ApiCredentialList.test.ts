import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ModelProviderProfileDetail } from '../../../shared/serviceInfo'
import type { SecretFieldRow } from '../../types'
import ApiCredentialList, {
  isOpenableHttpUrl,
  resolveApiCredentialFields,
} from './ApiCredentialList'
import apiCredentialListSource from './ApiCredentialList.tsx?raw'

function field(
  id: string,
  name: string,
  value: string,
  isSecret: number
): SecretFieldRow {
  return {
    id,
    service_id: 'service-1',
    group_id: null,
    field_name: name,
    field_value: value,
    is_secret: isSecret,
    sort_order: 0,
    created_at: '2026-08-30T00:00:00.000Z',
    updated_at: '2026-08-30T00:00:00.000Z',
  }
}

const profile: ModelProviderProfileDetail = {
  providerId: 'openai',
  baseUrlFieldId: 'base-url',
  keys: [
    { fieldId: 'key-production', purpose: '生产推理', manualBalance: '$25.40', sortOrder: 1 },
    { fieldId: 'key-development', purpose: '本地开发', manualBalance: '', sortOrder: 2 },
  ],
}

describe('ApiCredentialList', () => {
  it('resolves credentials strictly by id and renders every key masked by default', () => {
    const fields = [
      field('base-url', 'Base URL', 'https://api.openai.com/v1', 0),
      field('key-production', 'Production Key', 'sk-production-secret', 1),
      field('key-development', 'Development Key', 'sk-development-secret', 1),
    ]
    const resolved = resolveApiCredentialFields(profile, fields)
    expect(resolved.baseUrl?.id).toBe('base-url')
    expect(resolved.keys.map((key) => key.field?.id)).toEqual(['key-production', 'key-development'])

    const html = renderToStaticMarkup(React.createElement(ApiCredentialList, {
      profile,
      fields,
      onManage: () => undefined,
    }))
    expect(html).toContain('API 凭据')
    expect(html).toContain('https://api.openai.com/v1')
    expect(html).toContain('Production Key')
    expect(html).toContain('Development Key')
    expect(html).toContain('生产推理')
    expect(html).toContain('$25.40')
    expect(html).toContain('••••••••')
    expect(html).not.toContain('sk-production-secret')
    expect(html).not.toContain('sk-development-secret')
  })

  it('reports missing references and never substitutes same-name fields', () => {
    const missingProfile: ModelProviderProfileDetail = {
      providerId: 'custom',
      baseUrlFieldId: 'missing-base-url-id',
      keys: [{ fieldId: 'missing-key-id', purpose: '', manualBalance: '', sortOrder: 0 }],
    }
    const misleadingFields = [
      field('other-base-url', 'Base URL', 'https://wrong.example/v1', 0),
      field('other-key', 'API Key', 'must-not-be-used', 1),
    ]
    const resolved = resolveApiCredentialFields(missingProfile, misleadingFields)
    expect(resolved.baseUrl).toBeNull()
    expect(resolved.missingBaseUrlFieldId).toBe('missing-base-url-id')
    expect(resolved.keys[0].field).toBeNull()

    const html = renderToStaticMarkup(React.createElement(ApiCredentialList, {
      profile: missingProfile,
      fields: misleadingFields,
      onManage: () => undefined,
    }))
    expect(html).toContain('Base URL 引用的字段已缺失')
    expect(html).toContain('Key 1 引用的字段已缺失')
    expect(html).not.toContain('https://wrong.example/v1')
    expect(html).not.toContain('must-not-be-used')
  })

  it('blocks reveal and copy controls for an undecryptable key without rendering its ciphertext', () => {
    const ciphertext = `${'a'.repeat(32)}:${'b'.repeat(32)}:cafe`
    const brokenProfile: ModelProviderProfileDetail = {
      providerId: 'custom',
      baseUrlFieldId: null,
      keys: [{ fieldId: 'broken-key', purpose: '旧环境', manualBalance: '未知', sortOrder: 0 }],
    }
    const html = renderToStaticMarkup(React.createElement(ApiCredentialList, {
      profile: brokenProfile,
      fields: [field('broken-key', 'Broken Key', ciphertext, 1)],
      onManage: () => undefined,
    }))

    expect(html).toContain('无法解密')
    expect(html).toContain('该 Key 无法解密，已禁用显示与复制')
    expect(html).not.toContain(ciphertext)
    expect(html.match(/disabled=""/g)?.length || 0).toBeGreaterThanOrEqual(2)
  })

  it('renders an empty linked key as unconfigured and disables reveal and copy', () => {
    const emptyProfile: ModelProviderProfileDetail = {
      providerId: 'custom',
      baseUrlFieldId: null,
      keys: [{ fieldId: 'empty-key', purpose: '待配置', manualBalance: '', sortOrder: 0 }],
    }
    const html = renderToStaticMarkup(React.createElement(ApiCredentialList, {
      profile: emptyProfile,
      fields: [field('empty-key', 'Empty Key', '', 1)],
      onManage: () => undefined,
    }))

    expect(html).toContain('未配置')
    expect(html).toContain('该 Key 尚未配置')
    expect(html).not.toContain('••••••••')
    expect(html.match(/disabled=""/g)?.length || 0).toBeGreaterThanOrEqual(2)
  })

  it('only exposes HTTP(S) Base URLs and delegates opening and copy to guarded APIs', () => {
    expect(isOpenableHttpUrl('https://api.example.com/v1')).toBe(true)
    expect(isOpenableHttpUrl('http://127.0.0.1:11434/v1')).toBe(true)
    expect(isOpenableHttpUrl('file:///C:/secret.txt')).toBe(false)
    expect(isOpenableHttpUrl('not a url')).toBe(false)
    expect(apiCredentialListSource).toContain('window.electronAPI.openExternal(value)')
    expect(apiCredentialListSource).toContain('useCopyFeedback()')
  })
})
