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
] as const

export function assertValidJsonBackup(data: unknown): asserts data is Record<string, any> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('备份文件不是有效的 JSON 对象')
  }

  const record = data as Record<string, unknown>
  const presentKeys = ARRAY_KEYS.filter((key) => key in record)
  if (presentKeys.length === 0 || !Array.isArray(record.accounts) || !Array.isArray(record.totpAccounts)) {
    throw new Error('备份文件缺少账号或 2FA 数据结构')
  }

  for (const key of presentKeys) {
    if (!Array.isArray(record[key])) {
      throw new Error(`备份字段 ${key} 必须是数组`)
    }
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
}
