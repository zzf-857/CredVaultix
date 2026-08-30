import { describe, expect, it } from 'vitest'
import dialogSource from './ServiceFormDialog.tsx?raw'
import {
  buildCustomProviderPatch,
  buildProviderSelectionPatch,
  getConfirmedProviderInput,
  getAvailableApiKeyFields,
  getBaseUrlFieldOptions,
  getProviderInputError,
  isProviderInputPending,
  serviceFormCanSubmit,
} from './ServiceFormDialog'
import { createEmptyServiceFormValues } from './serviceForm'
import { getModelProviderById } from './modelProviders'
import type { SecretFieldRow } from '../../types'

const field = (id: string, isSecret = 0): SecretFieldRow => ({
  id,
  service_id: 'service-1',
  group_id: null,
  field_name: id,
  field_value: `${id}-value`,
  is_secret: isSecret,
  sort_order: 1,
  created_at: '2026-08-30T00:00:00.000Z',
  updated_at: '2026-08-30T00:00:00.000Z',
})

describe('ServiceFormDialog provider behavior', () => {
  it('fills empty provider defaults and changes an old provider default', () => {
    const openai = getModelProviderById('openai')!
    const anthropic = getModelProviderById('anthropic')!
    const empty = createEmptyServiceFormValues({
      baseUrlFieldId: 'base-url',
      apiKeyFieldId: 'api-key',
    })

    const openaiValues = { ...empty, ...buildProviderSelectionPatch(empty, openai) }
    expect(openaiValues).toMatchObject({
      providerId: 'openai',
      name: 'OpenAI',
      baseUrl: openai.baseUrl,
      url: openai.consoleUrl,
    })

    expect(buildProviderSelectionPatch(openaiValues, anthropic)).toMatchObject({
      providerId: 'anthropic',
      name: 'Anthropic',
      baseUrl: anthropic.baseUrl,
      url: anthropic.consoleUrl,
    })
  })

  it('preserves provider values that the user customized', () => {
    const anthropic = getModelProviderById('anthropic')!
    const values = {
      ...createEmptyServiceFormValues(),
      providerId: 'openai',
      name: 'Work gateway',
      baseUrl: 'https://gateway.example.com/v1',
      url: 'https://console.example.com',
    }

    expect(buildProviderSelectionPatch(values, anthropic)).toEqual({ providerId: 'anthropic' })
  })

  it('never rewrites an ordinary existing Base URL field when the provider changes', () => {
    const anthropic = getModelProviderById('anthropic')!
    const values = {
      ...createEmptyServiceFormValues(),
      providerId: 'openai',
      name: 'OpenAI',
      url: 'https://platform.openai.com/api-keys',
      baseUrlSource: 'existing' as const,
      baseUrlFieldId: 'ordinary-base-url',
      baseUrl: 'https://api.openai.com/v1',
      originalBaseUrl: 'https://api.openai.com/v1',
      baseUrlWasManaged: false,
    }

    expect(buildProviderSelectionPatch(values, anthropic)).toEqual({
      providerId: 'anthropic',
      name: 'Anthropic',
      url: 'https://console.anthropic.com/settings/keys',
    })
  })

  it('updates the original managed Base URL when it still equals the previous default', () => {
    const anthropic = getModelProviderById('anthropic')!
    const values = {
      ...createEmptyServiceFormValues(),
      providerId: 'openai',
      name: 'OpenAI',
      url: 'https://platform.openai.com/api-keys',
      baseUrlSource: 'existing' as const,
      baseUrlFieldId: 'managed-base-url',
      baseUrl: 'https://api.openai.com/v1',
      originalBaseUrl: 'https://api.openai.com/v1',
      originalBaseUrlFieldId: 'managed-base-url',
      baseUrlWasManaged: true,
    }

    expect(buildProviderSelectionPatch(values, anthropic)).toMatchObject({
      providerId: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
    })
  })

  it('uses committed freeSolo text as a custom provider and service name', () => {
    const values = createEmptyServiceFormValues()
    expect(buildCustomProviderPatch(values, 'Internal LLM')).toEqual({
      providerId: 'custom',
      name: 'Internal LLM',
    })
  })

  it('renames a confirmed custom provider and clears untouched built-in defaults', () => {
    const customValues = {
      ...createEmptyServiceFormValues(),
      providerId: 'custom',
      name: 'Internal LLM',
    }
    expect(buildCustomProviderPatch(customValues, 'Team Gateway', 'Internal LLM')).toMatchObject({
      providerId: 'custom',
      name: 'Team Gateway',
    })

    const openAiValues = {
      ...createEmptyServiceFormValues(),
      providerId: 'openai',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      url: 'https://platform.openai.com/api-keys',
    }
    expect(buildCustomProviderPatch(openAiValues, 'Internal LLM', 'OpenAI')).toMatchObject({
      providerId: 'custom',
      name: 'Internal LLM',
      baseUrl: '',
      url: '',
    })

    expect(buildCustomProviderPatch(openAiValues, '', 'OpenAI')).toMatchObject({
      providerId: '',
      name: '',
      baseUrl: '',
      url: '',
    })
  })

  it('treats search text as pending until the provider is explicitly confirmed', () => {
    const values = {
      ...createEmptyServiceFormValues(),
      providerId: 'openai',
      name: 'OpenAI',
    }

    expect(getConfirmedProviderInput(values)).toBe('OpenAI')
    expect(getProviderInputError(values, 'OpenAI')).toBeNull()
    expect(isProviderInputPending(values, 'OpenAI')).toBe(false)
    expect(getProviderInputError(values, 'Anth')).toMatch(/按 Enter/)
    expect(isProviderInputPending(values, 'Anth')).toBe(true)
    expect(getProviderInputError(values, '')).toMatch(/请选择厂商/)
  })

  it('keeps an imported unknown provider id editable without rewriting it', () => {
    const values = {
      ...createEmptyServiceFormValues(),
      providerId: 'legacy-provider',
      name: 'Legacy Gateway',
    }

    expect(getConfirmedProviderInput(values)).toBe('legacy-provider')
    expect(getProviderInputError(values, 'legacy-provider')).toBeNull()
    expect(isProviderInputPending(values, 'legacy-provider')).toBe(false)
    expect(isProviderInputPending(values, 'legacy')).toBe(true)
  })

  it('requires a provider only in model API mode', () => {
    const values = { ...createEmptyServiceFormValues(), name: 'Gateway' }
    expect(serviceFormCanSubmit(values, false)).toBe(false)
    expect(serviceFormCanSubmit({ ...values, providerId: 'custom' }, false)).toBe(true)
    expect(serviceFormCanSubmit({ ...values, mode: 'general' }, false)).toBe(true)
  })

  it('offers removed profile fields so source changes can be undone before save', () => {
    const originalBase = field('base-url')
    const removedKey = field('managed-key', 1)
    const values = {
      ...createEmptyServiceFormValues(),
      baseUrlSource: 'none' as const,
      baseUrlFieldId: '',
      originalBaseUrlFieldId: originalBase.id,
      detachKeyIds: [removedKey.id],
      apiKeys: [],
    }

    expect(getBaseUrlFieldOptions(values, [originalBase, removedKey]).map((item) => item.id))
      .toEqual([originalBase.id])
    expect(getAvailableApiKeyFields(values, [originalBase, removedKey]).map((item) => item.id))
      .toEqual([removedKey.id])
  })

  it('keeps the dialog scrollable and confirms every dirty close path', () => {
    expect(dialogSource).toContain("maxHeight: 'calc(100vh - 32px)'")
    expect(dialogSource).toContain("<DialogContent dividers sx={{ overflowY: 'auto' }}>")
    expect(dialogSource).toContain('onClose={requestClose}')
    expect(dialogSource).toContain('onClick={requestClose}')
    expect(dialogSource).toContain('if (dirty || providerInputPending)')
    expect(dialogSource).toContain('setCloseConfirmationOpen(true)')
  })

  it('keeps provider search local until an option or freeSolo value is committed', () => {
    const inputHandler = dialogSource.slice(
      dialogSource.indexOf('onInputChange={(nextInputValue) => {'),
      dialogSource.indexOf('disabled={busy}', dialogSource.indexOf('onInputChange={(nextInputValue) => {'))
    )

    expect(inputHandler).toContain('setProviderInputValue(nextInputValue)')
    expect(inputHandler).not.toContain('buildCustomProviderPatch')
    expect(inputHandler).not.toContain("reason === 'input'")
  })
})
