import { describe, expect, it } from 'vitest'
import { assertValidJsonBackup } from './backupValidation'

describe('assertValidJsonBackup', () => {
  it('accepts current and legacy account backup shapes', () => {
    expect(() => assertValidJsonBackup({ accounts: [], totpAccounts: [], tags: [] })).not.toThrow()
    expect(() => assertValidJsonBackup({
      accounts: [],
      totpAccounts: [],
      secretGroups: [],
      secretServices: [],
    })).not.toThrow()
  })

  it('rejects unrelated JSON and malformed arrays before destructive import', () => {
    expect(() => assertValidJsonBackup({ hello: 'world' })).toThrow(/缺少/)
    expect(() => assertValidJsonBackup({ accounts: {}, totpAccounts: [] })).toThrow(/缺少/)
    expect(() => assertValidJsonBackup({ accounts: [], totpAccounts: [], tags: {} })).toThrow(/tags/)
  })
})
