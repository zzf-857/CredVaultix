import { describe, expect, it } from 'vitest'
import { normalizeCsvAccountRow } from './csvAccountImport'

describe('normalizeCsvAccountRow', () => {
  it('maps common password-manager columns and preserves OTP URI parameters', () => {
    expect(normalizeCsvAccountRow({
      title: 'GitHub',
      login: 'owner@example.com',
      password: 'demo-password',
      phone: '+86 13800000000',
      recovery_email: 'recovery@example.com',
      totp: 'otpauth://hotp/GitHub:owner?secret=JBSWY3DPEHPK3PXP&algorithm=SHA256&digits=8&counter=42',
    })).toEqual({
      name: 'GitHub',
      platform: '',
      username: 'owner@example.com',
      password: 'demo-password',
      phone: '+86 13800000000',
      backupEmail: 'recovery@example.com',
      notes: '',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      otp: {
        issuer: 'GitHub',
        label: 'owner',
        secret: 'JBSWY3DPEHPK3PXP',
        algorithm: 'SHA256',
        digits: 8,
        period: 30,
        otpType: 'hotp',
        counter: 42,
      },
      invalidTotpUri: false,
    })
  })

  it('normalizes raw secrets, rejects invalid OTP URIs, and skips unrelated rows', () => {
    expect(normalizeCsvAccountRow({ name: 'Raw', totp: 'jbsw y3dp ehpk3pxp' })?.totpSecret)
      .toBe('JBSWY3DPEHPK3PXP')
    expect(normalizeCsvAccountRow({ name: 'BadSecret', totp: 'not-base32!!' })).toMatchObject({
      totpSecret: '',
      invalidTotpUri: true,
    })
    expect(normalizeCsvAccountRow({ name: 'Broken', totp: 'otpauth://totp/user' })).toMatchObject({
      totpSecret: '',
      invalidTotpUri: true,
    })
    expect(normalizeCsvAccountRow({ unknown: 'ignored' })).toBeNull()
  })

  it('trims and lowercases platform values', () => {
    expect(normalizeCsvAccountRow({ name: 'Mail', platform: 'Google' })?.platform).toBe('google')
    expect(normalizeCsvAccountRow({ name: 'Work', platform: ' MICROSOFT ' })?.platform).toBe('microsoft')
    expect(normalizeCsvAccountRow({ name: 'Code', platform: ' GitHub ' })?.platform).toBe('github')
    expect(normalizeCsvAccountRow({ name: 'QQ demo', type: 'QQ' })?.platform).toBe('qq')
    expect(normalizeCsvAccountRow({ name: 'Apple demo', platform: ' Apple ' })?.platform).toBe('apple')
  })
})
