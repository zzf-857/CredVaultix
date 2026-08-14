import { describe, expect, it } from 'vitest'
import {
  accountHasUndecryptableValues,
  fieldsHaveUndecryptableValues,
  isUndecryptedValue,
} from './decryptionHealth'

const leftoverCiphertext = `${'a'.repeat(32)}:${'b'.repeat(32)}:cafe0123`

describe('isUndecryptedValue', () => {
  it('flags values that still look like iv:tag:ciphertext after decryption', () => {
    expect(isUndecryptedValue(leftoverCiphertext)).toBe(true)
    expect(isUndecryptedValue(leftoverCiphertext.toUpperCase())).toBe(true)
  })

  it('accepts normal plaintext, empty and missing values', () => {
    expect(isUndecryptedValue('')).toBe(false)
    expect(isUndecryptedValue(null)).toBe(false)
    expect(isUndecryptedValue(undefined)).toBe(false)
    expect(isUndecryptedValue('JBSWY3DPEHPK3PXP')).toBe(false)
    expect(isUndecryptedValue('user@example.com')).toBe(false)
    expect(isUndecryptedValue('short:hex:pair')).toBe(false)
  })
})

describe('accountHasUndecryptableValues', () => {
  it('detects leftover ciphertext in any encrypted base field', () => {
    expect(accountHasUndecryptableValues({ password: leftoverCiphertext })).toBe(true)
    expect(accountHasUndecryptableValues({ totp_secret: leftoverCiphertext })).toBe(true)
    expect(accountHasUndecryptableValues({
      username: 'user@example.com',
      password: 'plain-password',
      phone: '',
      backup_email: null,
      totp_secret: 'JBSWY3DPEHPK3PXP',
    })).toBe(false)
  })

  it('only inspects secret custom fields', () => {
    expect(accountHasUndecryptableValues({
      customFields: [{ field_value: leftoverCiphertext, is_secret: 1 }],
    })).toBe(true)
    expect(accountHasUndecryptableValues({
      customFields: [{ field_value: leftoverCiphertext, is_secret: 0 }],
    })).toBe(false)
  })
})

describe('fieldsHaveUndecryptableValues', () => {
  it('flags secret service fields with leftover ciphertext', () => {
    expect(fieldsHaveUndecryptableValues([
      { field_value: 'plain', is_secret: 1 },
      { field_value: leftoverCiphertext, is_secret: 1 },
    ])).toBe(true)
    expect(fieldsHaveUndecryptableValues([
      { field_value: leftoverCiphertext, is_secret: 0 },
      { field_value: 'plain', is_secret: 1 },
    ])).toBe(false)
    expect(fieldsHaveUndecryptableValues([])).toBe(false)
  })
})
