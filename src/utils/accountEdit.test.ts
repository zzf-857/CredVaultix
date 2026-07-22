import { describe, expect, it } from 'vitest'
import { buildAccountUpdatePatch, type AccountEditDraft } from './accountEdit'

const account = {
  id: 'account-1',
  name: 'Google',
  platform: 'google',
  username: 'owner@example.com',
  password: 'old-password',
  phone: '',
  backup_email: '',
  totp_secret: 'JBSWY3DPEHPK3PXP',
  notes: 'old note',
  is_favorite: 0,
  created_at: '',
  updated_at: '',
} as const

const draft: AccountEditDraft = {
  name: account.name,
  platform: account.platform,
  username: account.username,
  password: account.password,
  phone: account.phone,
  backupEmail: account.backup_email,
  totpSecret: account.totp_secret,
  notes: account.notes,
}

describe('buildAccountUpdatePatch', () => {
  it('submits only changed fields so unrelated edits cannot clear a stale 2FA mirror', () => {
    expect(buildAccountUpdatePatch(account, { ...draft, notes: 'new note' })).toEqual({ notes: 'new note' })
  })

  it('includes a 2FA secret only when the user actually changes it', () => {
    expect(buildAccountUpdatePatch(account, draft)).not.toHaveProperty('totpSecret')
    expect(buildAccountUpdatePatch(account, { ...draft, totpSecret: '' })).toMatchObject({ totpSecret: '' })
  })
})
