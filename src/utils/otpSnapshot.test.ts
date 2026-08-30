import { describe, expect, it } from 'vitest'
import { generateOtpCode, getOtpTiming, isValidOtpSecret } from './otpSnapshot'

const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('OTP snapshots', () => {
  it('generates the RFC 6238 TOTP vector at a fixed timestamp', () => {
    expect(generateOtpCode({
      secret: RFC_SECRET,
      otpType: 'totp',
      algorithm: 'SHA1',
      digits: 8,
      period: 30,
    }, 59_000)).toEqual({ code: '94287082', empty: false, failed: false })
  })

  it('generates the RFC 4226 HOTP vector for a fixed counter', () => {
    expect(generateOtpCode({
      secret: RFC_SECRET,
      otpType: 'hotp',
      digits: 6,
      counter: 0,
    })).toEqual({ code: '755224', empty: false, failed: false })
  })

  it('returns stable placeholders for empty and malformed secrets', () => {
    expect(generateOtpCode({ secret: '', digits: 8 })).toEqual({
      code: '--------',
      empty: true,
      failed: false,
    })
    expect(generateOtpCode({ secret: 'NOT-BASE32-1', digits: 8 })).toEqual({
      code: '--------',
      empty: false,
      failed: true,
    })
    expect(isValidOtpSecret(RFC_SECRET)).toBe(true)
    expect(isValidOtpSecret('')).toBe(false)
  })

  it('derives the display timing without regenerating the OTP each second', () => {
    expect(getOtpTiming(12_345, 'totp', 30, 0)).toEqual({
      isHotp: false,
      period: 30,
      window: 0,
      remaining: 18,
      progress: 60,
      urgent: false,
    })
    expect(getOtpTiming(29_001, 'totp', 30, 0).urgent).toBe(true)
    expect(getOtpTiming(12_345, 'hotp', 30, 7)).toMatchObject({
      isHotp: true,
      window: 7,
      remaining: -1,
      progress: 100,
      urgent: false,
    })
  })
})
