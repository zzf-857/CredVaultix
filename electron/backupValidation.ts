import { SERVICE_INFO_BACKUP_VERSION } from './serviceInfoBackup'

const ARRAY_KEYS = [
  'tags',
  'totpAccounts',
  'totpQrImages',
  'accounts',
  'accountCustomFields',
  'accountTags',
  'secretGroups',
  'secretServices',
  'secretFieldGroups',
  'secretFields',
  'modelProviderProfiles',
  'modelProviderKeyMetadata',
] as const

const VERSION_2_ARRAY_KEYS = [
  'tags',
  'totpAccounts',
  'accounts',
  'accountCustomFields',
] as const

const VERSION_3_ARRAY_KEYS = ['accountTags'] as const
const VERSION_6_ARRAY_KEYS = ['totpQrImages'] as const

const LEGACY_SERVICE_ARRAY_KEYS = [
  'secretGroups',
  'secretServices',
  'secretFieldGroups',
  'secretFields',
] as const

const PROVIDER_ARRAY_KEYS = [
  'modelProviderProfiles',
  'modelProviderKeyMetadata',
] as const

function requireArrayKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
  message: string
) {
  const missing = keys.filter((key) => !Array.isArray(record[key]))
  if (missing.length > 0) {
    throw new Error(`${message}：${missing.join('、')}`)
  }
}

function readUniqueIdRows(
  value: unknown,
  label: string,
  idKey = 'id'
) {
  const rows = new Map<string, Record<string, unknown>>()
  if (!Array.isArray(value)) return rows

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${label}记录格式无效`)
    }
    const row = item as Record<string, unknown>
    const id = row[idKey]
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error(`${label}记录缺少有效的 ${idKey}`)
    }
    if (rows.has(id)) {
      throw new Error(`${label}包含重复 ${idKey}：${id}`)
    }
    rows.set(id, row)
  }

  return rows
}

export function assertValidJsonBackup(data: unknown): asserts data is Record<string, any> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('备份文件不是有效的 JSON 对象')
  }

  const record = data as Record<string, unknown>
  const version = record.version
  if (
    !Number.isInteger(version)
    || Number(version) < 2
    || Number(version) > SERVICE_INFO_BACKUP_VERSION
  ) {
    throw new Error(`不支持的备份版本：${String(version)}`)
  }

  const presentKeys = ARRAY_KEYS.filter((key) => key in record)
  if (presentKeys.length === 0 || !Array.isArray(record.accounts) || !Array.isArray(record.totpAccounts)) {
    throw new Error('备份文件缺少账号或 2FA 数据结构')
  }

  for (const key of presentKeys) {
    if (!Array.isArray(record[key])) {
      throw new Error(`备份字段 ${key} 必须是数组`)
    }
  }

  requireArrayKeys(record, VERSION_2_ARRAY_KEYS, '备份缺少 v2 账号数据')
  if (Number(version) >= 3) {
    requireArrayKeys(record, VERSION_3_ARRAY_KEYS, '备份缺少账号标签关系')
  }
  if (Number(version) >= 5) {
    requireArrayKeys(record, LEGACY_SERVICE_ARRAY_KEYS, '版本化备份缺少完整服务信息')
  }
  if (Number(version) >= 6) {
    requireArrayKeys(record, VERSION_6_ARRAY_KEYS, '备份缺少 2FA 二维码数据')
  }

  const hasAnyLegacyServiceData = LEGACY_SERVICE_ARRAY_KEYS.some((key) => key in record)
  if (hasAnyLegacyServiceData) {
    requireArrayKeys(record, LEGACY_SERVICE_ARRAY_KEYS, '服务信息备份不完整')
  }

  const hasAnyProviderData = PROVIDER_ARRAY_KEYS.some((key) => key in record)
  if (Number(version) >= 7 || hasAnyProviderData) {
    requireArrayKeys(record, LEGACY_SERVICE_ARRAY_KEYS, '模型厂商备份缺少基础服务信息')
    requireArrayKeys(record, PROVIDER_ARRAY_KEYS, '模型厂商备份不完整')
  }

  if (Number(version) >= 7) {
    requireArrayKeys(record, ARRAY_KEYS, '当前版本备份缺少必要数据')
  }

  if (Array.isArray(record.totpQrImages)) {
    for (const image of record.totpQrImages) {
      if (!image || typeof image !== 'object' || Array.isArray(image)) {
        throw new Error('二维码备份记录格式无效')
      }
      const row = image as Record<string, unknown>
      if (
        typeof row.totp_account_id !== 'string'
        || typeof row.encrypted_data_base64 !== 'string'
        || !/^[A-Za-z0-9+/]*={0,2}$/.test(row.encrypted_data_base64)
      ) {
        throw new Error('二维码备份记录缺少有效的账户 ID 或图片数据')
      }
      const decodedSize = Buffer.from(row.encrypted_data_base64, 'base64').length
      if (decodedSize === 0 || decodedSize > 30 * 1024 * 1024) {
        throw new Error('二维码备份图片大小无效')
      }
    }
  }

  const services = readUniqueIdRows(record.secretServices, '服务')
  const fields = readUniqueIdRows(record.secretFields, '服务字段')
  const profilesByService = new Map<string, Record<string, unknown>>()

  if (Array.isArray(record.modelProviderProfiles)) {
    const serviceIds = new Set<string>()
    for (const profile of record.modelProviderProfiles) {
      if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
        throw new Error('模型厂商备份记录格式无效')
      }
      const row = profile as Record<string, unknown>
      if (
        typeof row.service_id !== 'string'
        || !row.service_id.trim()
        || typeof row.provider_id !== 'string'
        || !row.provider_id.trim()
        || (row.base_url_field_id !== null
          && row.base_url_field_id !== undefined
          && (typeof row.base_url_field_id !== 'string' || !row.base_url_field_id.trim()))
      ) {
        throw new Error('模型厂商备份记录缺少有效的服务、厂商或 Base URL 字段 ID')
      }
      if (serviceIds.has(row.service_id)) {
        throw new Error(`模型厂商备份包含重复服务 ID：${row.service_id}`)
      }
      if (!services.has(row.service_id)) {
        throw new Error(`模型厂商引用了不存在的服务：${row.service_id}`)
      }
      if (typeof row.base_url_field_id === 'string') {
        const field = fields.get(row.base_url_field_id)
        if (!field) {
          throw new Error(`模型厂商引用了不存在的 Base URL 字段：${row.base_url_field_id}`)
        }
        if (field.service_id !== row.service_id) {
          throw new Error(`Base URL 字段不属于模型厂商服务：${row.service_id}`)
        }
      }
      serviceIds.add(row.service_id)
      profilesByService.set(row.service_id, row)
    }
  }

  if (Array.isArray(record.modelProviderKeyMetadata)) {
    const fieldIds = new Set<string>()
    for (const metadata of record.modelProviderKeyMetadata) {
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        throw new Error('模型厂商 Key 元数据备份记录格式无效')
      }
      const row = metadata as Record<string, unknown>
      if (typeof row.field_id !== 'string' || !row.field_id.trim()) {
        throw new Error('模型厂商 Key 元数据缺少有效的字段 ID')
      }
      if (fieldIds.has(row.field_id)) {
        throw new Error(`模型厂商 Key 元数据包含重复字段 ID：${row.field_id}`)
      }
      const field = fields.get(row.field_id)
      if (!field) {
        throw new Error(`模型厂商 Key 引用了不存在的字段：${row.field_id}`)
      }
      const serviceId = field.service_id
      if (typeof serviceId !== 'string' || !profilesByService.has(serviceId)) {
        throw new Error(`模型厂商 Key 字段没有同服务的厂商配置：${row.field_id}`)
      }
      if (profilesByService.get(serviceId)?.base_url_field_id === row.field_id) {
        throw new Error(`同一字段不能同时作为 Base URL 和 API Key：${row.field_id}`)
      }
      fieldIds.add(row.field_id)
    }
  }
}
