import { describe, expect, it } from 'vitest'
import type { SecretFieldRow, SecretServiceRow } from '../../types'
import {
  buildServiceFormSubmission,
  buildServicePresetFields,
  createEmptyServiceFormValues,
  createServiceFormValues,
  findPresetField,
  servicePresetFieldsNeedSaving,
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
  isSecret: number
): SecretFieldRow => ({
  id,
  service_id: service.id,
  group_id: null,
  field_name: fieldName,
  field_value: fieldValue,
  is_secret: isSecret,
  sort_order: 1,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
})

describe('service form presets', () => {
  it('starts new services without an implicit preset', () => {
    expect(createEmptyServiceFormValues()).toEqual({
      name: '',
      groupName: '',
      description: '',
      url: '',
      notes: '',
      linkedAccountId: '',
      fieldPreset: 'none',
      baseUrl: '',
      apiKey: '',
    })
  })

  it('builds the same normalized metadata payload for create and edit submissions', () => {
    expect(buildServiceFormSubmission({
      ...createEmptyServiceFormValues(),
      name: '  Payments API  ',
      description: '  Production endpoint  ',
      url: '  https://dashboard.example.com  ',
      notes: '  Rotate quarterly  ',
      linkedAccountId: 'account-1',
    }, 'group-1')).toEqual({
      name: 'Payments API',
      groupId: 'group-1',
      description: 'Production endpoint',
      url: 'https://dashboard.example.com',
      notes: 'Rotate quarterly',
      linkedAccountId: 'account-1',
    })
  })

  it('hydrates the shared edit form and recognizes a complete preset pair', () => {
    const fields = [
      field('field-base', 'base url', 'https://api.example.com', 0),
      field('field-key', 'API KEY', 'secret-value', 1),
    ]

    expect(createServiceFormValues(service, 'Production', fields)).toMatchObject({
      name: 'Payments API',
      groupName: 'Production',
      description: 'Production payments endpoint',
      linkedAccountId: 'account-1',
      fieldPreset: 'base-url-api-key',
      baseUrl: 'https://api.example.com',
      apiKey: 'secret-value',
    })
    expect(findPresetField(fields, 'Base URL')?.id).toBe('field-base')
  })

  it('does not infer a pair or write fields when only one preset field exists', () => {
    const fields = [field('field-key', 'API Key', 'secret-value', 1)]
    const values = createServiceFormValues(service, 'Production', fields)

    expect(values.fieldPreset).toBe('none')
    expect(buildServicePresetFields(values)).toEqual([])
    expect(servicePresetFieldsNeedSaving(values, fields)).toBe(false)
  })

  it('builds fixed field names and only saves an existing pair when values change', () => {
    const fields = [
      field('field-base', 'Base URL', 'https://api.example.com', 0),
      field('field-key', 'API Key', 'secret-value', 1),
    ]
    const values = createServiceFormValues(service, 'Production', fields)

    expect(buildServicePresetFields(values)).toEqual([
      { fieldName: 'Base URL', fieldValue: 'https://api.example.com', isSecret: false },
      { fieldName: 'API Key', fieldValue: 'secret-value', isSecret: true },
    ])
    expect(servicePresetFieldsNeedSaving(values, fields)).toBe(false)
    expect(servicePresetFieldsNeedSaving({ ...values, apiKey: 'rotated-key' }, fields)).toBe(true)
  })
})
