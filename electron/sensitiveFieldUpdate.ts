import { isEncryptedValue } from './encryptionFormat'

interface ResolveSensitiveFieldUpdateOptions {
  currentValue: string
  currentIsSecret: boolean
  nextValue?: string
  valueProvided: boolean
  nextIsSecret: boolean
  encrypt: (value: string) => string
  decrypt: (value: string) => string
}

type SensitiveFieldUpdate =
  | { shouldWrite: false }
  | { shouldWrite: true; storedValue: string }

export function resolveSensitiveFieldUpdate({
  currentValue,
  currentIsSecret,
  nextValue,
  valueProvided,
  nextIsSecret,
  encrypt,
  decrypt,
}: ResolveSensitiveFieldUpdateOptions): SensitiveFieldUpdate {
  const protectionChanged = nextIsSecret !== currentIsSecret
  if (!valueProvided && !protectionChanged) return { shouldWrite: false }

  let plainValue: string
  if (valueProvided && nextValue !== currentValue) {
    plainValue = nextValue ?? ''
  } else if (currentIsSecret) {
    const decryptedValue = decrypt(currentValue)
    const undecryptable = isEncryptedValue(currentValue) && decryptedValue === currentValue
    if (undecryptable) {
      if (protectionChanged) {
        throw new Error('当前敏感字段无法解密；请先提供新的字段值，再修改加密状态')
      }
      return { shouldWrite: false }
    }

    if (!protectionChanged) return { shouldWrite: false }
    plainValue = decryptedValue
  } else {
    if (!protectionChanged) return { shouldWrite: false }
    plainValue = currentValue
  }

  return {
    shouldWrite: true,
    storedValue: nextIsSecret ? encrypt(plainValue) : plainValue,
  }
}
