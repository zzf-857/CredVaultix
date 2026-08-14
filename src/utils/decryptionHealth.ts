import { isEncryptedValue } from './encryptionFormat'

// A decrypted field that still looks like "iv:tag:ciphertext" means the main
// process could not decrypt it (e.g. a backup restored under a different
// Windows user, where the path-derived key no longer matches).
export function isUndecryptedValue(value: string | null | undefined): boolean {
  return Boolean(value && isEncryptedValue(value))
}

interface SecretLikeField {
  field_value?: string | null
  is_secret?: number | boolean
}

interface AccountLikeRow {
  username?: string | null
  password?: string | null
  phone?: string | null
  backup_email?: string | null
  totp_secret?: string | null
  customFields?: SecretLikeField[]
}

export function accountHasUndecryptableValues(account: AccountLikeRow): boolean {
  const baseValues = [
    account.username,
    account.password,
    account.phone,
    account.backup_email,
    account.totp_secret,
  ]
  if (baseValues.some((value) => isUndecryptedValue(value))) return true
  return fieldsHaveUndecryptableValues(account.customFields || [])
}

export function fieldsHaveUndecryptableValues(fields: SecretLikeField[]): boolean {
  return fields.some((field) => Boolean(field.is_secret) && isUndecryptedValue(field.field_value))
}

export const UNDECRYPTABLE_VALUES_HINT =
  '检测到无法解密的敏感字段。该数据可能来自其他电脑或其他 Windows 用户的备份;'
  + '本机密钥与其不匹配,显示的密文无法还原。请回到原环境导出备份,或手动重新录入。'
