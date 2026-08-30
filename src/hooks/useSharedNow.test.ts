import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getSharedNowMs,
  getTotpRemainingSeconds,
  getTotpWindow,
  resetSharedNowForTests,
  subscribeSharedNow,
} from './useSharedNow'

afterEach(() => {
  resetSharedNowForTests()
  vi.useRealTimers()
})

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

describe('shared TOTP ticker scheduling', () => {
  it('refreshes immediately on the first subscription and then ticks on whole seconds', () => {
    vi.useFakeTimers()
    vi.setSystemTime(12_345)
    resetSharedNowForTests(1_000)
    const snapshots: number[] = []

    const unsubscribe = subscribeSharedNow(() => snapshots.push(getSharedNowMs()))

    expect(snapshots).toEqual([12_345])
    vi.advanceTimersByTime(654)
    expect(snapshots).toEqual([12_345])
    vi.advanceTimersByTime(1)
    expect(snapshots).toEqual([12_345, 13_000])
    vi.advanceTimersByTime(1_000)
    expect(snapshots).toEqual([12_345, 13_000, 14_000])

    unsubscribe()
  })

  it('stops scheduling updates after the last subscriber leaves', () => {
    vi.useFakeTimers()
    vi.setSystemTime(20_250)
    resetSharedNowForTests(0)
    const listener = vi.fn()
    const unsubscribe = subscribeSharedNow(listener)

    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    vi.advanceTimersByTime(5_000)

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
