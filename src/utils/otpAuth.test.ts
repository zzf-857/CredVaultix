import { describe, expect, it } from 'vitest'
import { parseOtpAuthUri } from './otpAuth'

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
