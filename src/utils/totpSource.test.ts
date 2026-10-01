import { describe, expect, it } from 'vitest'
import {
  applyTotpGroupOrder,
  getTotpAccountPlatform,
  groupTotpAccountsByPlatform,
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

describe('groupTotpAccountsByPlatform', () => {
  it('keeps every unsourced linked account visible for all supported platforms', () => {
    const platforms = ['google', 'microsoft', 'github', 'qq', 'apple', 'other']
    const linkedAccounts = platforms.map((platform) => ({ id: `main-${platform}`, platform }))
    const records = platforms.map((platform) => ({
      id: `totp-${platform}`,
      linked_account_id: `main-${platform}`,
      label: 'demo@example.com',
      issuer: '',
      source: '',
    }))
    const grouped = groupTotpAccountsByPlatform(records, linkedAccounts)

    expect(grouped.map((group) => group.groupId)).toEqual(platforms.map((platform) => `group-${platform}`))
    expect(grouped.flatMap((group) => group.accounts.map((account) => account.id)))
      .toEqual(records.map((account) => account.id))
    for (const group of grouped) {
      expect(group.accounts.map((account) => account.id)).toEqual([`totp-${group.platform}`])
    }
  })

  it('keeps explicit source groups authoritative and unknown linked platforms in other', () => {
    const linkedAccounts = [{ id: 'main-github', platform: 'github' }, { id: 'main-custom', platform: 'custom' }]
    const records = [
      { id: 'sourced', linked_account_id: 'main-github', source: '旧手机', issuer: 'GitHub' },
      { id: 'unsourced', linked_account_id: 'main-github', source: '', issuer: 'Google' },
      { id: 'custom', linked_account_id: 'main-custom', source: '', issuer: 'GitHub' },
    ]
    const { sourceGroups, unsourced } = groupTotpAccountsBySource(records)
    const grouped = groupTotpAccountsByPlatform(unsourced, linkedAccounts)

    expect(sourceGroups.map((group) => group.accounts.map((account) => account.id))).toEqual([['sourced']])
    expect(grouped.map((group) => [group.platform, group.accounts.map((account) => account.id)]))
      .toEqual([['github', ['unsourced']], ['other', ['custom']]])
  })

  it('preserves legacy inference and recognizes standalone new platform accounts', () => {
    const cases = [
      [{ label: 'demo@gmail.com' }, 'google'],
      [{ issuer: 'Google' }, 'google'],
      [{ label: 'demo@live.com' }, 'microsoft'],
      [{ issuer: 'Microsoft' }, 'microsoft'],
      [{ issuer: 'GitHub' }, 'github'],
      [{ label: '100001@qq.com' }, 'qq'],
      [{ issuer: 'QQ' }, 'qq'],
      [{ issuer: 'Apple' }, 'apple'],
      [{ label: 'demo@icloud.com' }, 'apple'],
      [{ issuer: 'Custom service' }, 'other'],
    ] as const
    for (const [account, platform] of cases) {
      expect(getTotpAccountPlatform(account, [])).toBe(platform)
    }
    expect(getTotpAccountPlatform({ linked_account_id: 'missing', issuer: 'GitHub' }, [])).toBe('github')
  })

  it('prioritizes linked accounts, then issuer brands, over a login email provider', () => {
    const cases = [
      [{ issuer: 'Apple', label: 'demo@gmail.com' }, 'apple'],
      [{ issuer: 'GitHub', label: 'demo@outlook.com' }, 'github'],
      [{ issuer: 'QQ邮箱', label: 'demo@icloud.com' }, 'qq'],
      [{ issuer: 'Google Cloud', label: 'demo@icloud.com' }, 'google'],
      [{ issuer: 'Gmail', label: 'demo@outlook.com' }, 'google'],
      [{ issuer: 'Microsoft Azure', label: 'demo@gmail.com' }, 'microsoft'],
      [{ issuer: 'Outlook', label: 'demo@gmail.com' }, 'microsoft'],
      [{ issuer: 'Hotmail', label: 'demo@gmail.com' }, 'microsoft'],
    ] as const
    for (const [account, platform] of cases) {
      expect(getTotpAccountPlatform(account, [])).toBe(platform)
    }
    expect(getTotpAccountPlatform(
      { linked_account_id: 'main-apple', issuer: 'GitHub', label: 'demo@gmail.com' },
      [{ id: 'main-apple', platform: 'apple' }],
    )).toBe('apple')
  })

  it('does not infer a brand from a substring in an unrelated issuer or label', () => {
    expect(getTotpAccountPlatform({ issuer: 'Pineapple', label: 'demo@example.com' }, [])).toBe('other')
    expect(getTotpAccountPlatform({ issuer: 'Pineapple', label: 'demo@gmail.com' }, [])).toBe('google')
    expect(getTotpAccountPlatform({ issuer: 'Custom service', label: 'pineapple@example.com' }, [])).toBe('other')
    expect(getTotpAccountPlatform({ issuer: 'notgithub', label: 'demo@example.com' }, [])).toBe('other')
    expect(getTotpAccountPlatform({ issuer: 'github.com', label: 'demo@example.com' }, [])).toBe('github')
  })
})
