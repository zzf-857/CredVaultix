import { describe, expect, it } from 'vitest'
import { getTotpRemainingSeconds, getTotpWindow } from './useSharedNow'

describe('shared TOTP ticker math', () => {
  it('counts remaining seconds inside a period window', () => {
    expect(getTotpRemainingSeconds(0, 30)).toBe(30)
    expect(getTotpRemainingSeconds(1_000, 30)).toBe(29)
    expect(getTotpRemainingSeconds(29_000, 30)).toBe(1)
    expect(getTotpRemainingSeconds(30_000, 30)).toBe(30)
  })

  it('advances the HMAC window only when the period boundary is crossed', () => {
    expect(getTotpWindow(0, 30)).toBe(0)
    expect(getTotpWindow(29_999, 30)).toBe(0)
    expect(getTotpWindow(30_000, 30)).toBe(1)
    expect(getTotpWindow(90_000, 30)).toBe(3)
  })

  it('falls back to a 30 second period when the configured period is invalid', () => {
    expect(getTotpRemainingSeconds(1_000, 0)).toBe(29)
    expect(getTotpWindow(30_000, 0)).toBe(1)
  })
})
