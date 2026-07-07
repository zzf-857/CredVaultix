import { describe, expect, it } from 'vitest'
import {
  getAccountPlatformLabel,
  normalizeAccountPlatform,
} from './accountPlatform'

describe('normalizeAccountPlatform', () => {
  it('normalizes known values', () => {
    expect(normalizeAccountPlatform('google')).toBe('google')
    expect(normalizeAccountPlatform('microsoft')).toBe('microsoft')
  })

  it('normalizes unknown or empty values to other', () => {
    expect(normalizeAccountPlatform('')).toBe('other')
    expect(normalizeAccountPlatform('github')).toBe('other')
    expect(normalizeAccountPlatform(null)).toBe('other')
    expect(normalizeAccountPlatform(undefined)).toBe('other')
  })
})

describe('getAccountPlatformLabel', () => {
  it('returns human readable labels', () => {
    expect(getAccountPlatformLabel('google')).toBe('Google')
    expect(getAccountPlatformLabel('microsoft')).toBe('Microsoft')
    expect(getAccountPlatformLabel('other')).toBe('其他')
  })
})
