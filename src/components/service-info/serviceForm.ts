import type { CreateSecretServiceData, SecretFieldRow, SecretServiceRow } from '../../types'

export type ServiceFieldPreset = 'none' | 'base-url-api-key'

export interface ServiceFormValues {
  name: string
  groupName: string
  description: string
  url: string
  notes: string
  linkedAccountId: string
  fieldPreset: ServiceFieldPreset
  baseUrl: string
  apiKey: string
}

export interface ServicePresetFieldDraft {
  fieldName: 'Base URL' | 'API Key'
  fieldValue: string
  isSecret: boolean
}

const normalizeFieldName = (value: string) => value.trim().toLocaleLowerCase()

export function createEmptyServiceFormValues(): ServiceFormValues {
  return {
    name: '',
    groupName: '',
    description: '',
    url: '',
    notes: '',
    linkedAccountId: '',
    fieldPreset: 'none',
    baseUrl: '',
    apiKey: '',
  }
}

export function findPresetField(fields: SecretFieldRow[], fieldName: ServicePresetFieldDraft['fieldName']) {
  const normalizedName = normalizeFieldName(fieldName)
  return fields.find((field) => normalizeFieldName(field.field_name) === normalizedName)
}

export function createServiceFormValues(
  service: SecretServiceRow,
  groupName: string,
  fields: SecretFieldRow[]
): ServiceFormValues {
  const baseUrlField = findPresetField(fields, 'Base URL')
  const apiKeyField = findPresetField(fields, 'API Key')

  return {
    name: service.name,
    groupName,
    description: service.description || '',
    url: service.url || '',
    notes: service.notes || '',
    linkedAccountId: service.linked_account_id || '',
    fieldPreset: baseUrlField && apiKeyField ? 'base-url-api-key' : 'none',
    baseUrl: baseUrlField?.field_value || '',
    apiKey: apiKeyField?.field_value || '',
  }
}

export function buildServicePresetFields(values: ServiceFormValues): ServicePresetFieldDraft[] {
  if (values.fieldPreset !== 'base-url-api-key') return []

  return [
    { fieldName: 'Base URL', fieldValue: values.baseUrl, isSecret: false },
    { fieldName: 'API Key', fieldValue: values.apiKey, isSecret: true },
  ]
}

export function buildServiceFormSubmission(
  values: ServiceFormValues,
  groupId: string | null
): Omit<CreateSecretServiceData, 'id'> {
  return {
    name: values.name.trim(),
    groupId,
    description: values.description.trim(),
    url: values.url.trim(),
    notes: values.notes.trim(),
    linkedAccountId: values.linkedAccountId || null,
  }
}

export function servicePresetFieldsNeedSaving(values: ServiceFormValues, fields: SecretFieldRow[]) {
  return buildServicePresetFields(values).some((presetField) => {
    const existingField = findPresetField(fields, presetField.fieldName)
    return !existingField
      || existingField.field_value !== presetField.fieldValue
      || Boolean(existingField.is_secret) !== presetField.isSecret
  })
}
