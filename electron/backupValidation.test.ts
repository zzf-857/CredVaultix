import { describe, expect, it } from 'vitest'
import { assertValidJsonBackup } from './backupValidation'

function currentBackup(overrides: Record<string, unknown> = {}) {
  return {
    version: 7,
    tags: [],
    totpAccounts: [],
    totpQrImages: [],
    accounts: [],
    accountCustomFields: [],
    accountTags: [],
    secretGroups: [],
    secretServices: [],
    secretFieldGroups: [],
    secretFields: [],
    modelProviderProfiles: [],
    modelProviderKeyMetadata: [],
    ...overrides,
  }
}

describe('assertValidJsonBackup', () => {
  it('accepts current and legacy account backup shapes', () => {
    expect(() => assertValidJsonBackup({
      version: 2,
      accounts: [],
      totpAccounts: [],
      tags: [],
      accountCustomFields: [],
    })).not.toThrow()
    expect(() => assertValidJsonBackup(currentBackup({
      secretServices: [{ id: 'service-1' }],
      secretFields: [
        { id: 'base-url', service_id: 'service-1' },
        { id: 'api-key', service_id: 'service-1' },
      ],
      modelProviderProfiles: [{
        service_id: 'service-1',
        provider_id: 'openai',
        base_url_field_id: 'base-url',
      }],
      modelProviderKeyMetadata: [{
        field_id: 'api-key',
        purpose: 'production',
        manual_balance: '$10',
      }],
    }))).not.toThrow()
    expect(() => assertValidJsonBackup({
      version: 3,
      accounts: [],
      totpAccounts: [],
      tags: [],
      accountCustomFields: [],
      accountTags: [],
      preferences: { themeMode: 'light', sidebarCollapsed: true },
    })).not.toThrow()
  })

  it('rejects unrelated JSON and malformed arrays before destructive import', () => {
    expect(() => assertValidJsonBackup({ hello: 'world' })).toThrow(/不支持的备份版本|缺少/)
    expect(() => assertValidJsonBackup({ version: 2, accounts: {}, totpAccounts: [] })).toThrow(/缺少/)
    expect(() => assertValidJsonBackup({
      version: 2,
      accounts: [],
      totpAccounts: [],
      tags: {},
      accountCustomFields: [],
    })).toThrow(/tags/)
    expect(() => assertValidJsonBackup({
      version: 5,
      accounts: [],
      totpAccounts: [],
      tags: [],
      accountCustomFields: [],
      accountTags: [],
      secretServices: [],
    })).toThrow(/服务信息备份不完整|缺少完整服务信息/)
    expect(() => assertValidJsonBackup(currentBackup({ secretFields: undefined })))
      .toThrow(/secretFields|缺少完整服务信息|缺少必要数据/)
    expect(() => assertValidJsonBackup(currentBackup({ version: 8 }))).toThrow(/不支持的备份版本/)
    expect(() => assertValidJsonBackup({ accounts: [], totpAccounts: [] }))
      .toThrow(/不支持的备份版本/)
    expect(() => assertValidJsonBackup({
      version: 6,
      tags: [],
      totpAccounts: [],
      accounts: [],
      accountCustomFields: [],
      accountTags: [],
      secretGroups: [],
      secretServices: [],
      secretFieldGroups: [],
      secretFields: [],
    })).toThrow(/二维码数据/)
  })

  it('rejects malformed or duplicate provider metadata before destructive import', () => {
    expect(() => assertValidJsonBackup(currentBackup({
      secretServices: [{ id: 'service-1' }],
      modelProviderProfiles: [{ service_id: 'service-1', provider_id: '' }],
    }))).toThrow(/厂商/)
    expect(() => assertValidJsonBackup(currentBackup({
      secretServices: [{ id: 'service-1' }],
      modelProviderProfiles: [
        { service_id: 'service-1', provider_id: 'openai' },
        { service_id: 'service-1', provider_id: 'custom' },
      ],
    }))).toThrow(/重复服务 ID/)
    expect(() => assertValidJsonBackup(currentBackup({
      secretFields: [{ id: 'key-1', service_id: 'service-1' }],
      secretServices: [{ id: 'service-1' }],
      modelProviderProfiles: [{ service_id: 'service-1', provider_id: 'openai' }],
      modelProviderKeyMetadata: [{ field_id: 'key-1' }, { field_id: 'key-1' }],
    }))).toThrow(/重复字段 ID/)
  })

  it('rejects provider metadata that crosses service ownership boundaries', () => {
    expect(() => assertValidJsonBackup(currentBackup({
      secretServices: [{ id: 'service-1' }, { id: 'service-2' }],
      secretFields: [{ id: 'base-url-2', service_id: 'service-2' }],
      modelProviderProfiles: [{
        service_id: 'service-1',
        provider_id: 'openai',
        base_url_field_id: 'base-url-2',
      }],
    }))).toThrow(/不属于模型厂商服务/)

    expect(() => assertValidJsonBackup(currentBackup({
      secretServices: [{ id: 'service-1' }, { id: 'service-2' }],
      secretFields: [{ id: 'key-2', service_id: 'service-2' }],
      modelProviderProfiles: [{ service_id: 'service-1', provider_id: 'openai' }],
      modelProviderKeyMetadata: [{ field_id: 'key-2' }],
    }))).toThrow(/没有同服务的厂商配置/)
  })
})
