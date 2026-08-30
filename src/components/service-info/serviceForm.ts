import { v4 as uuidv4 } from 'uuid'
import type {
  ModelProviderProfileCommand,
  ModelProviderProfileDetail,
  ServiceEditorMode,
} from '../../../shared/serviceInfo'
import type { CreateSecretServiceData, SecretFieldRow, SecretServiceRow } from '../../types'
import { isUndecryptedValue } from '../../utils/decryptionHealth'

export type ServiceBaseUrlSource = 'none' | 'new' | 'existing'

export interface ServiceApiKeyDraft {
  fieldId: string
  wasManaged: boolean
  label: string
  value: string
  purpose: string
  manualBalance: string
  isSecret: boolean
  undecryptable: boolean
  originalLabel: string | null
  originalValue: string | null
  originalIsSecret: boolean | null
}

export interface ServiceFormValues {
  name: string
  groupName: string
  description: string
  url: string
  notes: string
  linkedAccountId: string
  mode: ServiceEditorMode
  providerId: string
  baseUrlSource: ServiceBaseUrlSource
  baseUrlFieldId: string
  baseUrl: string
  originalBaseUrl: string | null
  originalBaseUrlFieldId: string | null
  baseUrlWasManaged: boolean
  apiKeys: ServiceApiKeyDraft[]
  detachKeyIds: string[]
  detachedApiKeys: ServiceApiKeyDraft[]
}

export interface EmptyServiceFormIds {
  baseUrlFieldId?: string
  apiKeyFieldId?: string
}

export type ServiceFormSubmission = Omit<CreateSecretServiceData, 'id'> & {
  providerProfile?: ModelProviderProfileCommand | null
}

export interface BuildServiceFormSubmissionOptions {
  clearProviderProfileForGeneral?: boolean
}

export function findNamedGroup<T extends { name: string }>(
  groups: readonly T[],
  name: string
) {
  const normalized = name.trim().toLowerCase()
  return groups.find((group) => group.name.trim().toLowerCase() === normalized)
}

export function createServiceApiKeyDraft(fieldId = uuidv4()): ServiceApiKeyDraft {
  return {
    fieldId,
    wasManaged: false,
    label: 'API Key',
    value: '',
    purpose: '',
    manualBalance: '',
    isSecret: true,
    undecryptable: false,
    originalLabel: null,
    originalValue: null,
    originalIsSecret: null,
  }
}

export function isNewServiceApiKeyDraft(draft: ServiceApiKeyDraft) {
  return draft.originalValue === null
}

export function isPristineNewServiceApiKeyDraft(draft: ServiceApiKeyDraft) {
  return isNewServiceApiKeyDraft(draft)
    && (!draft.label.trim() || draft.label.trim() === 'API Key')
    && !draft.value.trim()
    && !draft.purpose.trim()
    && !draft.manualBalance.trim()
    && draft.isSecret
}

export function getServiceApiKeyDraftError(draft: ServiceApiKeyDraft): string | null {
  if (isPristineNewServiceApiKeyDraft(draft)) return null
  return draft.value.trim() ? null : 'API Key 值不能为空'
}

export function serviceApiKeysAreValid(drafts: readonly ServiceApiKeyDraft[]) {
  return drafts.every((draft) => getServiceApiKeyDraftError(draft) === null)
}

export function createServiceApiKeyDraftFromField(
  field: SecretFieldRow,
  wasManaged = false
): ServiceApiKeyDraft {
  const isSecret = Boolean(field.is_secret)
  return {
    fieldId: field.id,
    wasManaged,
    label: field.field_name,
    value: field.field_value,
    purpose: '',
    manualBalance: '',
    isSecret,
    undecryptable: isSecret && isUndecryptedValue(field.field_value),
    originalLabel: field.field_name,
    originalValue: field.field_value,
    originalIsSecret: isSecret,
  }
}

export function claimServiceApiKeyField(
  keys: readonly ServiceApiKeyDraft[],
  detachKeyIds: readonly string[],
  field: SecretFieldRow,
  detachedApiKeys: readonly ServiceApiKeyDraft[] = []
) {
  if (keys.some((key) => key.fieldId === field.id)) {
    return {
      keys: [...keys],
      detachKeyIds: [...detachKeyIds],
      detachedApiKeys: [...detachedApiKeys],
    }
  }

  const wasManaged = detachKeyIds.includes(field.id)
  const detachedDraft = detachedApiKeys.find((key) => key.fieldId === field.id)
  const activeKeys = keys.length === 1 && isPristineNewServiceApiKeyDraft(keys[0])
    ? []
    : [...keys]
  return {
    keys: [...activeKeys, detachedDraft || createServiceApiKeyDraftFromField(field, wasManaged)],
    detachKeyIds: detachKeyIds.filter((fieldId) => fieldId !== field.id),
    detachedApiKeys: detachedApiKeys.filter((key) => key.fieldId !== field.id),
  }
}

export function removeServiceApiKeyDraft(
  keys: readonly ServiceApiKeyDraft[],
  detachKeyIds: readonly string[],
  fieldId: string,
  detachedApiKeys: readonly ServiceApiKeyDraft[] = []
) {
  const target = keys.find((key) => key.fieldId === fieldId)
  if (!target) {
    return {
      keys: [...keys],
      detachKeyIds: [...detachKeyIds],
      detachedApiKeys: [...detachedApiKeys],
    }
  }

  const nextDetachIds = target.wasManaged
    ? [...detachKeyIds, target.fieldId]
    : detachKeyIds

  return {
    keys: keys.filter((key) => key.fieldId !== fieldId),
    detachKeyIds: [...new Set(nextDetachIds)],
    detachedApiKeys: target.wasManaged
      ? [...detachedApiKeys.filter((key) => key.fieldId !== fieldId), target]
      : [...detachedApiKeys],
  }
}

export function createEmptyServiceFormValues(ids: EmptyServiceFormIds = {}): ServiceFormValues {
  return {
    name: '',
    groupName: '',
    description: '',
    url: '',
    notes: '',
    linkedAccountId: '',
    mode: 'model-provider',
    providerId: '',
    baseUrlSource: 'new',
    baseUrlFieldId: ids.baseUrlFieldId || uuidv4(),
    baseUrl: '',
    originalBaseUrl: null,
    originalBaseUrlFieldId: null,
    baseUrlWasManaged: false,
    apiKeys: [createServiceApiKeyDraft(ids.apiKeyFieldId)],
    detachKeyIds: [],
    detachedApiKeys: [],
  }
}

function createClaimedApiKeyDraft(
  field: SecretFieldRow | undefined,
  detail: ModelProviderProfileDetail['keys'][number]
): ServiceApiKeyDraft {
  const label = field?.field_name || 'API Key'
  const value = field?.field_value || ''
  const isSecret = field ? Boolean(field.is_secret) : true
  const undecryptable = Boolean(field && isSecret && isUndecryptedValue(value))

  return {
    fieldId: detail.fieldId,
    wasManaged: true,
    label,
    value,
    purpose: detail.purpose || '',
    manualBalance: detail.manualBalance || '',
    isSecret,
    undecryptable,
    originalLabel: label,
    originalValue: value,
    originalIsSecret: isSecret,
  }
}

export function createServiceFormValues(
  service: SecretServiceRow,
  groupName: string,
  fields: SecretFieldRow[],
  providerProfile?: ModelProviderProfileDetail | null
): ServiceFormValues {
  const fieldsById = new Map(fields.map((field) => [field.id, field]))
  const baseUrlField = providerProfile?.baseUrlFieldId
    ? fieldsById.get(providerProfile.baseUrlFieldId)
    : undefined
  const claimedKeys = providerProfile
    ? [...providerProfile.keys]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((key) => createClaimedApiKeyDraft(fieldsById.get(key.fieldId), key))
    : []

  return {
    name: service.name,
    groupName,
    description: service.description || '',
    url: service.url || '',
    notes: service.notes || '',
    linkedAccountId: service.linked_account_id || '',
    mode: providerProfile ? 'model-provider' : 'general',
    providerId: providerProfile?.providerId || '',
    baseUrlSource: baseUrlField ? 'existing' : 'none',
    baseUrlFieldId: baseUrlField?.id || '',
    baseUrl: baseUrlField?.field_value || '',
    originalBaseUrl: baseUrlField ? baseUrlField.field_value : null,
    originalBaseUrlFieldId: providerProfile?.baseUrlFieldId || null,
    baseUrlWasManaged: Boolean(baseUrlField),
    apiKeys: claimedKeys,
    detachKeyIds: [],
    detachedApiKeys: [],
  }
}

export type ServiceBaseUrlSelection = Pick<
  ServiceFormValues,
  'baseUrlSource' | 'baseUrlFieldId' | 'baseUrl' | 'originalBaseUrl' | 'baseUrlWasManaged'
>

export function createNoServiceBaseUrlSelection(): ServiceBaseUrlSelection {
  return {
    baseUrlSource: 'none',
    baseUrlFieldId: '',
    baseUrl: '',
    originalBaseUrl: null,
    baseUrlWasManaged: false,
  }
}

export function createNewServiceBaseUrlSelection(
  value = '',
  fieldId = uuidv4()
): ServiceBaseUrlSelection {
  return {
    baseUrlSource: 'new',
    baseUrlFieldId: fieldId,
    baseUrl: value,
    originalBaseUrl: null,
    baseUrlWasManaged: false,
  }
}

export function createExistingServiceBaseUrlSelection(
  field: SecretFieldRow,
  wasManaged = false
): ServiceBaseUrlSelection {
  return {
    baseUrlSource: 'existing',
    baseUrlFieldId: field.id,
    baseUrl: field.field_value,
    originalBaseUrl: field.field_value,
    baseUrlWasManaged: wasManaged,
  }
}

export function getServiceBaseUrlError(values: ServiceFormValues): string | null {
  if (values.baseUrlSource === 'none') return null
  if (
    values.baseUrlSource === 'existing'
    && values.originalBaseUrl !== null
    && values.baseUrl === values.originalBaseUrl
  ) {
    return null
  }

  const baseUrl = values.baseUrl.trim()
  if (!baseUrl) return null

  const urlWithoutPlaceholders = baseUrl.replace(
    /\{[A-Za-z0-9][A-Za-z0-9._-]*\}/g,
    'placeholder'
  )
  if (/[{}]/.test(urlWithoutPlaceholders)) {
    return 'Base URL 包含无效或残缺的模板占位符'
  }

  try {
    const parsed = new URL(urlWithoutPlaceholders)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Base URL 必须以 http:// 或 https:// 开头'
    }
  } catch {
    return '请输入有效的 Base URL'
  }

  return null
}

function buildBaseUrlCommand(values: ServiceFormValues): ModelProviderProfileCommand['baseUrl'] {
  const baseUrl = values.baseUrl.trim()
  if (values.baseUrlSource === 'none') return null

  if (values.baseUrlSource === 'new' && !baseUrl) return null

  if (!values.baseUrlFieldId) {
    throw new Error('Base URL 缺少稳定字段 ID')
  }

  if (values.baseUrlSource === 'new') {
    return {
      fieldId: values.baseUrlFieldId,
      fieldName: 'Base URL',
      fieldValue: baseUrl,
    }
  }

  if (values.originalBaseUrl === null) {
    throw new Error('已有 Base URL 字段缺少原始值')
  }

  return {
    fieldId: values.baseUrlFieldId,
    ...(values.baseUrl !== values.originalBaseUrl ? { fieldValue: baseUrl } : {}),
  }
}

function assertUndecryptableKeyWasNotRewritten(key: ServiceApiKeyDraft) {
  if (!key.undecryptable) return

  if (key.value !== key.originalValue || key.isSecret !== key.originalIsSecret) {
    throw new Error(`无法解密的 Key“${key.label || key.fieldId}”不能修改值或加密状态`)
  }
}

function buildApiKeyCommand(
  key: ServiceApiKeyDraft,
  sortOrder: number
): ModelProviderProfileCommand['keys'][number] {
  if (!key.fieldId) throw new Error('API Key 缺少稳定字段 ID')
  assertUndecryptableKeyWasNotRewritten(key)

  const label = key.label.trim() || 'API Key'
  const command: ModelProviderProfileCommand['keys'][number] = {
    fieldId: key.fieldId,
    purpose: key.purpose.trim(),
    manualBalance: key.manualBalance.trim(),
    sortOrder,
  }

  if (isNewServiceApiKeyDraft(key)) {
    command.fieldName = label
    command.fieldValue = key.value
    command.isSecret = key.isSecret
    return command
  }

  if (label !== key.originalLabel) command.fieldName = label
  if (key.value !== key.originalValue) command.fieldValue = key.value
  if (key.isSecret !== key.originalIsSecret) command.isSecret = key.isSecret
  return command
}

export function buildModelProviderProfile(values: ServiceFormValues): ModelProviderProfileCommand {
  if (values.mode !== 'model-provider') {
    throw new Error('通用服务不能构建模型厂商配置')
  }

  const baseUrlError = getServiceBaseUrlError(values)
  if (baseUrlError) throw new Error(baseUrlError)

  const apiKeys = values.apiKeys.filter((key) => !isPristineNewServiceApiKeyDraft(key))
  const invalidApiKey = apiKeys.find((key) => getServiceApiKeyDraftError(key))
  if (invalidApiKey) {
    const label = invalidApiKey.label.trim() || 'API Key'
    throw new Error(`“${label}”的 API Key 值不能为空`)
  }

  const activeKeyIds = new Set(apiKeys.map((key) => key.fieldId))
  return {
    providerId: values.providerId.trim(),
    baseUrl: buildBaseUrlCommand(values),
    keys: apiKeys.map((key, index) => buildApiKeyCommand(key, index + 1)),
    detachKeyIds: [...new Set(values.detachKeyIds)].filter((fieldId) => !activeKeyIds.has(fieldId)),
  }
}

export function buildServiceFormSubmission(
  values: ServiceFormValues,
  groupId: string | null,
  options: BuildServiceFormSubmissionOptions = {}
): ServiceFormSubmission {
  const metadata: Omit<CreateSecretServiceData, 'id'> = {
    name: values.name.trim(),
    groupId,
    description: values.description.trim(),
    url: values.url.trim(),
    notes: values.notes.trim(),
    linkedAccountId: values.linkedAccountId || null,
  }

  if (values.mode === 'model-provider') {
    return { ...metadata, providerProfile: buildModelProviderProfile(values) }
  }

  return options.clearProviderProfileForGeneral
    ? { ...metadata, providerProfile: null }
    : metadata
}
