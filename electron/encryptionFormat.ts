const ENCRYPTED_VALUE_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/i

export function isEncryptedValue(value: string): boolean {
  return Boolean(value && ENCRYPTED_VALUE_PATTERN.test(value))
}
