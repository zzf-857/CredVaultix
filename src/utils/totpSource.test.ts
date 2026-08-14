import { describe, expect, it } from 'vitest'
import {
  applyTotpGroupOrder,
  groupTotpAccountsBySource,
  moveTotpGroupId,
  normalizeTotpSource,
  rememberTotpGroupAtEnd,
  suggestGoogleMigrationSourceName,
  suggestSingleImportSourceName,
  toggleTotpGroupCollapsed,
  totpSourceGroupId,
} from './totpSource'

describe('normalizeTotpSource', () => {
  it('trims, collapses spaces, and caps length', () => {
    expect(normalizeTotpSource('  旧手机   导出  ')).toBe('旧手机 导出')
    expect(normalizeTotpSource('x'.repeat(120))).toHaveLength(80)
    expect(normalizeTotpSource('   ')).toBe('')
  })
})

describe('suggestGoogleMigrationSourceName', () => {
  it('uses the local date and avoids colliding with an existing source', () => {
    const now = new Date(2026, 7, 14, 16, 5)
    expect(suggestGoogleMigrationSourceName([], now)).toBe('Google Authenticator · 2026-08-14')
    expect(suggestGoogleMigrationSourceName(['Google Authenticator · 2026-08-14'], now))
      .toBe('Google Authenticator · 2026-08-14 16:05')
    expect(suggestGoogleMigrationSourceName([
      'Google Authenticator · 2026-08-14',
      'Google Authenticator · 2026-08-14 16:05',
    ], now)).toBe('Google Authenticator · 2026-08-14 (2)')
  })
})

describe('suggestSingleImportSourceName', () => {
  it('uses the issuer and avoids colliding with an existing group', () => {
    expect(suggestSingleImportSourceName('GitHub', 'octocat', [])).toBe('GitHub')
    expect(suggestSingleImportSourceName('GitHub', 'octocat', ['GitHub'])).toBe('GitHub (2)')
    expect(suggestSingleImportSourceName('', '', [], new Date(2026, 7, 14))).toBe('新分组 · 2026-08-14')
  })
})

describe('totp group order and collapse', () => {
  it('keeps a saved order and appends newly appeared groups at the end', () => {
    expect(applyTotpGroupOrder(['source-a', 'group-google', 'group-other'], ['group-other', 'source-a']))
      .toEqual(['group-other', 'source-a', 'group-google'])
    expect(rememberTotpGroupAtEnd(['group-google', 'group-other'], ['group-google', 'group-other'], 'source-new'))
      .toEqual(['group-google', 'group-other', 'source-new'])
    expect(rememberTotpGroupAtEnd(['source-a', 'group-google'], ['source-a', 'group-google'], 'source-a'))
      .toEqual(['source-a', 'group-google'])
  })

  it('moves a sidebar group onto another group and toggles collapse', () => {
    expect(moveTotpGroupId(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
    expect(toggleTotpGroupCollapsed(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleTotpGroupCollapsed(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('groupTotpAccountsBySource', () => {
  it('keeps sourced accounts out of the unsourced platform buckets', () => {
    const grouped = groupTotpAccountsBySource([
      { id: '1', source: '旧手机' },
      { id: '2', source: ' 旧手机 ' },
      { id: '3', source: '' },
      { id: '4', source: 'Google Authenticator · 2026-08-14' },
    ])

    expect(grouped.unsourced.map((account) => account.id)).toEqual(['3'])
    expect(Object.fromEntries(grouped.sourceGroups.map((group) => [group.source, group.accounts.map((account) => account.id)]))).toEqual({
      'Google Authenticator · 2026-08-14': ['4'],
      '旧手机': ['1', '2'],
    })
    expect(grouped.sourceGroups.find((group) => group.source === '旧手机')?.groupId).toBe(totpSourceGroupId('旧手机'))
  })
})
