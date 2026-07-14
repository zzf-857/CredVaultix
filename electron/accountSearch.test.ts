import { describe, expect, it } from 'vitest'
import { accountMatchesSearch } from './accountSearch'

const account = {
  name: '工作主账号',
  username: 'owner@example.com',
  phone: '+86 13800000000',
  backup_email: 'recovery@example.com',
  notes: '生产环境管理员',
  tags: [{ name: 'GitHub' }],
}

describe('accountMatchesSearch', () => {
  it('matches decrypted identity and recovery fields case-insensitively', () => {
    expect(accountMatchesSearch(account, 'OWNER@EXAMPLE.COM')).toBe(true)
    expect(accountMatchesSearch(account, '1380000')).toBe(true)
    expect(accountMatchesSearch(account, 'recovery@')).toBe(true)
  })

  it('matches account names, notes, and reusable tags', () => {
    expect(accountMatchesSearch(account, '工作')).toBe(true)
    expect(accountMatchesSearch(account, '管理员')).toBe(true)
    expect(accountMatchesSearch(account, 'github')).toBe(true)
  })

  it('rejects unrelated terms and accepts an empty query', () => {
    expect(accountMatchesSearch(account, 'notion')).toBe(false)
    expect(accountMatchesSearch(account, '   ')).toBe(true)
  })
})
