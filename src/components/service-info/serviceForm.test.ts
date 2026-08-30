import { describe, expect, it } from 'vitest'
import type { ModelProviderProfileDetail } from '../../../shared/serviceInfo'
import type { SecretFieldRow, SecretServiceRow } from '../../types'
import {
  buildModelProviderProfile,
  buildServiceFormSubmission,
  claimServiceApiKeyField,
  createExistingServiceBaseUrlSelection,
  createEmptyServiceFormValues,
  createNewServiceBaseUrlSelection,
  createNoServiceBaseUrlSelection,
  createServiceApiKeyDraft,
  createServiceApiKeyDraftFromField,
  createServiceFormValues,
  findNamedGroup,
  getServiceBaseUrlError,
  getServiceApiKeyDraftError,
  removeServiceApiKeyDraft,
  serviceApiKeysAreValid,
} from './serviceForm'

const service: SecretServiceRow = {
  id: 'service-1',
  group_id: 'group-1',
  linked_account_id: 'account-1',
  name: 'Payments API',
  description: 'Production payments endpoint',
  url: 'https://dashboard.example.com',
  notes: 'Rotate quarterly',
  is_favorite: 0,
  is_deleted: 0,
  deleted_at: null,
  sort_order: 1,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
}

const field = (
  id: string,
  fieldName: string,
  fieldValue: string,
  isSecret: number,
  sortOrder = 1
): SecretFieldRow => ({
  id,
  service_id: service.id,
  group_id: null,
  field_name: fieldName,
  field_value: fieldValue,
  is_secret: isSecret,
  sort_order: sortOrder,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
})

const fields = [
  field('base-url', 'Base URL', 'https://api.example.com', 0),
  field('key-production', 'API Key', 'sk-production', 1, 2),
  field('key-development', 'API Key', 'sk-development', 1, 1),
  field('legacy-key', 'API Key', 'leave-this-alone', 1, 3),
]

const profile: ModelProviderProfileDetail = {
  providerId: 'openai',
  baseUrlFieldId: 'base-url',
  keys: [
    {
      fieldId: 'key-production',
      purpose: '生产环境',
      manualBalance: '$20',
      sortOrder: 2,
    },
    {
      fieldId: 'key-development',
      purpose: '开发环境',
      manualBalance: '$5',
      sortOrder: 1,
    },
  ],
}

describe('model provider service form', () => {
  it('matches an existing group without case or surrounding-space drift', () => {
    const groups = [
      { id: 'production', name: 'Production' },
      { id: 'staging', name: 'Staging' },
    ]

    expect(findNamedGroup(groups, '  PRODUCTION  ')).toEqual(groups[0])
    expect(findNamedGroup(groups, 'missing')).toBeUndefined()
  })

  it('starts in model-provider mode with stable field ids and one encrypted key draft', () => {
    const values = createEmptyServiceFormValues({
      baseUrlFieldId: 'new-base-url',
      apiKeyFieldId: 'new-key',
    })

    expect(values).toMatchObject({
      mode: 'model-provider',
      providerId: '',
      baseUrlSource: 'new',
      baseUrlFieldId: 'new-base-url',
      baseUrl: '',
      originalBaseUrl: null,
      originalBaseUrlFieldId: null,
      baseUrlWasManaged: false,
      detachKeyIds: [],
      apiKeys: [{
        fieldId: 'new-key',
        wasManaged: false,
        label: 'API Key',
        value: '',
        purpose: '',
        manualBalance: '',
        isSecret: true,
        originalValue: null,
      }],
    })
  })

  it('hydrates only field ids explicitly claimed by the profile', () => {
    const values = createServiceFormValues(service, 'Production', fields, profile)

    expect(values.mode).toBe('model-provider')
    expect(values.providerId).toBe('openai')
    expect(values.baseUrl).toBe('https://api.example.com')
    expect(values.baseUrlSource).toBe('existing')
    expect(values.baseUrlWasManaged).toBe(true)
    expect(values.apiKeys.map((key) => ({
      fieldId: key.fieldId,
      label: key.label,
      value: key.value,
      purpose: key.purpose,
    }))).toEqual([
      {
        fieldId: 'key-development',
        label: 'API Key',
        value: 'sk-development',
        purpose: '开发环境',
      },
      {
        fieldId: 'key-production',
        label: 'API Key',
        value: 'sk-production',
        purpose: '生产环境',
      },
    ])
    expect(values.apiKeys.some((key) => key.fieldId === 'legacy-key')).toBe(false)
  })

  it('does not infer a provider profile from legacy field names', () => {
    const values = createServiceFormValues(service, 'Production', fields)

    expect(values.mode).toBe('general')
    expect(values.providerId).toBe('')
    expect(values.baseUrl).toBe('')
    expect(values.apiKeys).toEqual([])
    expect(buildServiceFormSubmission(values, 'group-1')).not.toHaveProperty('providerProfile')
    expect(buildServiceFormSubmission(values, 'group-1', {
      clearProviderProfileForGeneral: true,
    })).toHaveProperty('providerProfile', null)
  })

  it('omits unchanged existing field values while preserving stable same-name key ids', () => {
    const values = createServiceFormValues(service, 'Production', fields, profile)
    const submission = buildServiceFormSubmission(values, 'group-1')

    expect(submission).toMatchObject({
      name: 'Payments API',
      groupId: 'group-1',
      linkedAccountId: 'account-1',
      providerProfile: {
        providerId: 'openai',
        baseUrl: { fieldId: 'base-url' },
        detachKeyIds: [],
        keys: [
          {
            fieldId: 'key-development',
            purpose: '开发环境',
            manualBalance: '$5',
            sortOrder: 1,
          },
          {
            fieldId: 'key-production',
            purpose: '生产环境',
            manualBalance: '$20',
            sortOrder: 2,
          },
        ],
      },
    })

    for (const key of submission.providerProfile!.keys) {
      expect(key).not.toHaveProperty('fieldValue')
      expect(key).not.toHaveProperty('fieldName')
      expect(key).not.toHaveProperty('isSecret')
    }
  })

  it('patches only the key selected by field id', () => {
    const values = createServiceFormValues(service, 'Production', fields, profile)
    values.apiKeys = values.apiKeys.map((key) => key.fieldId === 'key-production'
      ? { ...key, value: 'sk-rotated', label: 'Production Key' }
      : key)

    const command = buildModelProviderProfile(values)
    expect(command.keys).toEqual([
      {
        fieldId: 'key-development',
        purpose: '开发环境',
        manualBalance: '$5',
        sortOrder: 1,
      },
      {
        fieldId: 'key-production',
        fieldName: 'Production Key',
        fieldValue: 'sk-rotated',
        purpose: '生产环境',
        manualBalance: '$20',
        sortOrder: 2,
      },
    ])
  })

  it('sends full values for new keys and only a changed encryption flag for legacy plaintext', () => {
    const values = createServiceFormValues(service, 'Production', [
      ...fields,
      field('plaintext-key', 'Legacy Key', 'plain-value', 0),
    ], {
      ...profile,
      keys: [{ fieldId: 'plaintext-key', purpose: '', manualBalance: '', sortOrder: 1 }],
    })
    values.apiKeys[0] = { ...values.apiKeys[0], isSecret: true }
    values.apiKeys.push({
      ...createServiceApiKeyDraft('new-key'),
      label: 'Backup Key',
      value: 'sk-backup',
      purpose: '故障切换',
      manualBalance: '100 credits',
    })

    expect(buildModelProviderProfile(values).keys).toEqual([
      {
        fieldId: 'plaintext-key',
        isSecret: true,
        purpose: '',
        manualBalance: '',
        sortOrder: 1,
      },
      {
        fieldId: 'new-key',
        fieldName: 'Backup Key',
        fieldValue: 'sk-backup',
        isSecret: true,
        purpose: '故障切换',
        manualBalance: '100 credits',
        sortOrder: 2,
      },
    ])
  })

  it('detaches an existing key without deleting its field and drops a removed new draft locally', () => {
    const values = createServiceFormValues(service, 'Production', fields, profile)
    const withNew = [...values.apiKeys, createServiceApiKeyDraft('new-key')]

    const removedExisting = removeServiceApiKeyDraft(withNew, [], 'key-production')
    expect(removedExisting.keys.map((key) => key.fieldId)).toEqual(['key-development', 'new-key'])
    expect(removedExisting.detachKeyIds).toEqual(['key-production'])

    const removedNew = removeServiceApiKeyDraft(
      removedExisting.keys,
      removedExisting.detachKeyIds,
      'new-key'
    )
    expect(removedNew.keys.map((key) => key.fieldId)).toEqual(['key-development'])
    expect(removedNew.detachKeyIds).toEqual(['key-production'])

    expect(buildModelProviderProfile({
      ...values,
      apiKeys: removedNew.keys,
      detachKeyIds: removedNew.detachKeyIds,
    })).toMatchObject({
      keys: [{ fieldId: 'key-development' }],
      detachKeyIds: ['key-production'],
    })
  })

  it('does not detach a pre-existing ordinary field that was only claimed in this edit', () => {
    const claimed = createServiceApiKeyDraftFromField(fields[3])
    expect(claimed).toMatchObject({
      fieldId: 'legacy-key',
      wasManaged: false,
      originalValue: 'leave-this-alone',
    })

    const removed = removeServiceApiKeyDraft([claimed], [], claimed.fieldId)
    expect(removed.keys).toEqual([])
    expect(removed.detachKeyIds).toEqual([])
  })

  it('can reclaim a removed managed key and detach it again in the same edit', () => {
    const values = createServiceFormValues(service, 'Production', fields, profile)
    const removed = removeServiceApiKeyDraft(values.apiKeys, [], 'key-production')
    const reclaimed = claimServiceApiKeyField(
      removed.keys,
      removed.detachKeyIds,
      fields[1]
    )

    expect(reclaimed.detachKeyIds).toEqual([])
    expect(reclaimed.keys[reclaimed.keys.length - 1]).toMatchObject({
      fieldId: 'key-production',
      wasManaged: true,
      originalValue: 'sk-production',
    })

    const removedAgain = removeServiceApiKeyDraft(
      reclaimed.keys,
      reclaimed.detachKeyIds,
      'key-production'
    )
    expect(removedAgain.detachKeyIds).toEqual(['key-production'])
  })

  it('never rewrites an undecryptable key value or encryption state', () => {
    const ciphertext = `${'a'.repeat(32)}:${'b'.repeat(32)}:cafe`
    const values = createServiceFormValues(service, 'Production', [
      field('locked-key', 'API Key', ciphertext, 1),
    ], {
      providerId: 'openai',
      baseUrlFieldId: null,
      keys: [{ fieldId: 'locked-key', purpose: '生产', manualBalance: '', sortOrder: 1 }],
    })

    expect(values.apiKeys[0].undecryptable).toBe(true)
    expect(buildModelProviderProfile(values).keys[0]).not.toHaveProperty('fieldValue')

    expect(() => buildModelProviderProfile({
      ...values,
      apiKeys: [{ ...values.apiKeys[0], value: 'replacement' }],
    })).toThrow(/无法解密/)
    expect(() => buildModelProviderProfile({
      ...values,
      apiKeys: [{ ...values.apiKeys[0], isSecret: false }],
    })).toThrow(/无法解密/)
  })

  it('creates a Base URL field only when needed and never resends an unchanged value', () => {
    const empty = createEmptyServiceFormValues({ baseUrlFieldId: 'new-base', apiKeyFieldId: 'new-key' })
    expect(buildModelProviderProfile(empty).baseUrl).toBeNull()

    expect(buildModelProviderProfile({ ...empty, baseUrl: '  https://api.openai.com/v1  ' }).baseUrl)
      .toEqual({
        fieldId: 'new-base',
        fieldName: 'Base URL',
        fieldValue: 'https://api.openai.com/v1',
      })

    const existing = createServiceFormValues(service, 'Production', fields, profile)
    expect(buildModelProviderProfile(existing).baseUrl).toEqual({ fieldId: 'base-url' })
    expect(buildModelProviderProfile({ ...existing, baseUrl: 'https://new.example.com' }).baseUrl)
      .toEqual({ fieldId: 'base-url', fieldValue: 'https://new.example.com' })
  })

  it('switches Base URL sources without rewriting the previously selected field', () => {
    const values = createServiceFormValues(service, 'Production', fields, profile)

    const none = { ...values, ...createNoServiceBaseUrlSelection() }
    expect(buildModelProviderProfile(none).baseUrl).toBeNull()
    expect(none.originalBaseUrlFieldId).toBe('base-url')

    const fresh = {
      ...none,
      ...createNewServiceBaseUrlSelection('https://new.example.com', 'new-base-url'),
    }
    expect(buildModelProviderProfile(fresh).baseUrl).toEqual({
      fieldId: 'new-base-url',
      fieldName: 'Base URL',
      fieldValue: 'https://new.example.com',
    })

    const claimed = {
      ...fresh,
      ...createExistingServiceBaseUrlSelection(fields[3]),
    }
    expect(buildModelProviderProfile(claimed).baseUrl).toEqual({ fieldId: 'legacy-key' })
    expect(claimed.baseUrlWasManaged).toBe(false)

    const restored = {
      ...fresh,
      ...createExistingServiceBaseUrlSelection(fields[0], true),
    }
    expect(restored.baseUrlWasManaged).toBe(true)
  })

  it('ignores only a pristine empty new Key and does not require any Key', () => {
    const values = createEmptyServiceFormValues({ apiKeyFieldId: 'new-key' })

    expect(getServiceApiKeyDraftError(values.apiKeys[0])).toBeNull()
    expect(serviceApiKeysAreValid(values.apiKeys)).toBe(true)
    expect(buildModelProviderProfile(values).keys).toEqual([])
    expect(serviceApiKeysAreValid([])).toBe(true)
    expect(buildModelProviderProfile({ ...values, apiKeys: [] }).keys).toEqual([])
  })

  it.each([
    ['名称', { label: 'Backup Key' }],
    ['用途', { purpose: '故障切换' }],
    ['余额', { manualBalance: '100 credits' }],
    ['加密设置', { isSecret: false }],
  ])('rejects a new Key with %s metadata but no value', (_metadata, patch) => {
    const values = createEmptyServiceFormValues({ apiKeyFieldId: 'new-key' })
    const key = { ...values.apiKeys[0], ...patch }

    expect(getServiceApiKeyDraftError(key)).toBe('API Key 值不能为空')
    expect(serviceApiKeysAreValid([key])).toBe(false)
    expect(() => buildModelProviderProfile({ ...values, apiKeys: [key] }))
      .toThrow(/API Key 值不能为空/)
  })

  it('rejects an existing Key that was cleared and accepts a populated new Key', () => {
    const existingValues = createServiceFormValues(service, 'Production', fields, profile)
    const cleared = { ...existingValues.apiKeys[0], value: '   ' }

    expect(getServiceApiKeyDraftError(cleared)).toBe('API Key 值不能为空')
    expect(() => buildModelProviderProfile({ ...existingValues, apiKeys: [cleared] }))
      .toThrow(/API Key 值不能为空/)

    const populated = {
      ...createServiceApiKeyDraft('new-key'),
      value: 'sk-valid',
      purpose: '生产',
    }
    expect(getServiceApiKeyDraftError(populated)).toBeNull()
    expect(serviceApiKeysAreValid([populated])).toBe(true)
  })

  it('validates new Base URLs, including complete template placeholders', () => {
    const values = createEmptyServiceFormValues()

    expect(getServiceBaseUrlError(values)).toBeNull()
    expect(getServiceBaseUrlError({
      ...values,
      baseUrl: 'https://{resource-name}.openai.azure.com/openai/v1',
    })).toBeNull()
    expect(getServiceBaseUrlError({ ...values, baseUrl: 'ftp://api.example.com' }))
      .toMatch(/http/)
    expect(getServiceBaseUrlError({ ...values, baseUrl: 'api.example.com/v1' }))
      .toBeTruthy()
    expect(getServiceBaseUrlError({ ...values, baseUrl: 'https://{resource-name.example.com' }))
      .toMatch(/占位符/)
    expect(getServiceBaseUrlError({ ...values, baseUrl: 'https://{}.example.com' }))
      .toMatch(/占位符/)
  })

  it('allows an unchanged historical Base URL but validates it after any edit', () => {
    const legacyField = field('legacy-base', 'Base URL', '  legacy internal endpoint  ', 0)
    const values = {
      ...createEmptyServiceFormValues(),
      ...createExistingServiceBaseUrlSelection(legacyField, true),
    }

    expect(getServiceBaseUrlError(values)).toBeNull()
    expect(buildModelProviderProfile(values).baseUrl).toEqual({ fieldId: 'legacy-base' })

    const modified = { ...values, baseUrl: 'legacy internal endpoint/v2' }
    expect(getServiceBaseUrlError(modified)).toBeTruthy()
    expect(() => buildModelProviderProfile(modified)).toThrow(/Base URL/)
  })
})
