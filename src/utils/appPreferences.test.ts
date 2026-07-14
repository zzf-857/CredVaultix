import { describe, expect, it } from 'vitest'
import { resolveAppPreferences } from './appPreferences'

describe('resolveAppPreferences', () => {
  it('keeps valid shared preferences and sanitizes duplicate identifiers', () => {
    expect(resolveAppPreferences({
      accountsPinnedIds: ['a', 'a', '', 7 as any],
      accountsCustomOrder: ['b', 'a'],
      themeMode: 'light',
      serviceSortMode: 'updated-desc',
    }, ['legacy'], ['legacy'])).toEqual({
      accountsPinnedIds: ['a'],
      accountsCustomOrder: ['b', 'a'],
      themeMode: 'light',
      serviceSortMode: 'updated-desc',
      needsAccountPreferenceMigration: false,
    })
  })

  it('migrates only valid legacy arrays and rejects malformed persisted values', () => {
    expect(resolveAppPreferences({
      accountsPinnedIds: 'broken' as any,
      serviceSortMode: 'unknown' as any,
    }, ['legacy-pin'], { bad: true })).toEqual({
      accountsPinnedIds: ['legacy-pin'],
      accountsCustomOrder: [],
      themeMode: 'dark',
      serviceSortMode: 'manual',
      needsAccountPreferenceMigration: true,
    })
  })
})
