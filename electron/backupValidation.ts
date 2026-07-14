const ARRAY_KEYS = [
  'tags',
  'totpAccounts',
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
}
