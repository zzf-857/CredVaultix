import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_PLATFORMS,
  ACCOUNT_PLATFORM_OPTIONS,
  getAccountPlatformDefaultName,
  getAccountPlatformLabel,
  normalizeAccountPlatform,
} from './accountPlatform'

describe('normalizeAccountPlatform', () => {
  it.each(ACCOUNT_PLATFORMS)('preserves the %s platform', (platform) => {
    expect(normalizeAccountPlatform(platform)).toBe(platform)
  })

  it('normalizes unknown or empty values to other', () => {
    expect(normalizeAccountPlatform('')).toBe('other')
    expect(normalizeAccountPlatform('unknown')).toBe('other')
    expect(normalizeAccountPlatform('GitHub')).toBe('other')
    expect(normalizeAccountPlatform(null)).toBe('other')
    expect(normalizeAccountPlatform(undefined)).toBe('other')
  })
})

describe('getAccountPlatformLabel', () => {
  it('returns human readable labels', () => {
    expect(getAccountPlatformLabel('google')).toBe('Google')
    expect(getAccountPlatformLabel('microsoft')).toBe('Microsoft')
    expect(getAccountPlatformLabel('github')).toBe('GitHub')
    expect(getAccountPlatformLabel('qq')).toBe('QQ')
    expect(getAccountPlatformLabel('apple')).toBe('Apple')
    expect(getAccountPlatformLabel('other')).toBe('其他')
  })
})

describe('account platform options', () => {
  it('offers each supported main account once with a description and default name', () => {
    expect(ACCOUNT_PLATFORM_OPTIONS.map((option) => option.platform))
      .toEqual(['google', 'microsoft', 'github', 'qq', 'apple'])
    for (const option of ACCOUNT_PLATFORM_OPTIONS) {
      expect(option.description).not.toBe('')
      expect(getAccountPlatformLabel(option.platform)).toBe(option.label)
      expect(getAccountPlatformDefaultName(option.platform)).toBe(`${option.label} 账号`)
    }
    expect(getAccountPlatformDefaultName('other')).toBe('新账号')
  })
})
