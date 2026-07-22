import { describe, expect, it } from 'vitest'
import { normalizeOtpInput, parseOtpAuthUri } from './otpAuth'

describe('parseOtpAuthUri', () => {
  it('preserves non-default TOTP parameters', () => {
    expect(parseOtpAuthUri(
      'otpauth://totp/Example:user%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example&algorithm=SHA256&digits=8&period=60'
    )).toEqual({
      issuer: 'Example',
      label: 'user@example.com',
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA256',
      digits: 8,
      period: 60,
      otpType: 'totp',
      counter: 0,
    })
  })

  it('preserves an HOTP counter and derives the issuer from the label', () => {
    const parsed = parseOtpAuthUri(
      'otpauth://hotp/GitHub:owner?secret=JBSWY3DPEHPK3PXP&counter=42'
    )
    expect(parsed?.issuer).toBe('GitHub')
    expect(parsed?.label).toBe('owner')
    expect(parsed?.otpType).toBe('hotp')
    expect(parsed?.counter).toBe(42)
  })

  it('rejects unsupported schemes, types, and missing secrets', () => {
    expect(parseOtpAuthUri('https://example.com')).toBeNull()
    expect(parseOtpAuthUri('otpauth://steam/user?secret=ABC')).toBeNull()
    expect(parseOtpAuthUri('otpauth://totp/user')).toBeNull()
    expect(parseOtpAuthUri('otpauth://totp/user?secret=NOT-BASE32-1')).toBeNull()
  })
})

describe('normalizeOtpInput', () => {
  it('normalizes grouped Base32 secrets and accepts an empty value for explicit removal', () => {
    expect(normalizeOtpInput('jbsw y3dp ehpk3pxp')).toEqual({
      secret: 'JBSWY3DPEHPK3PXP',
      parsedUri: null,
    })
    expect(normalizeOtpInput('   ')).toEqual({ secret: '', parsedUri: null })
  })

  it('returns parsed URI metadata and rejects malformed input', () => {
    const normalized = normalizeOtpInput(
      'otpauth://totp/Example:owner?secret=JBSWY3DPEHPK3PXP&issuer=Example&period=60'
    )
    expect(normalized?.secret).toBe('JBSWY3DPEHPK3PXP')
    expect(normalized?.parsedUri).toMatchObject({ issuer: 'Example', label: 'owner', period: 60 })
    expect(normalizeOtpInput('not-base32-1')).toBeNull()
  })
})
