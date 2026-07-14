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
    expect(normalizeCsvAccountRow({ name: 'Broken', totp: 'otpauth://totp/user' })).toMatchObject({
      totpSecret: '',
      invalidTotpUri: true,
    })
    expect(normalizeCsvAccountRow({ unknown: 'ignored' })).toBeNull()
  })
})
