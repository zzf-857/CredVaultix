import type { AccountRow, UpdateAccountData } from '../types'
import type { AccountPlatform } from './accountPlatform'

export interface AccountEditDraft {
  name: string
  platform: AccountPlatform
  username: string
  password: string
  phone: string
  backupEmail: string
  totpSecret: string
  notes: string
}

export function buildAccountUpdatePatch(account: AccountRow, draft: AccountEditDraft): UpdateAccountData {
  const patch: UpdateAccountData = {}
  const name = draft.name.trim()
  if (name !== account.name) patch.name = name
  if (draft.platform !== account.platform) patch.platform = draft.platform
  if (draft.username !== account.username) patch.username = draft.username
  if (draft.password !== account.password) patch.password = draft.password
  if (draft.phone !== account.phone) patch.phone = draft.phone
  if (draft.backupEmail !== account.backup_email) patch.backupEmail = draft.backupEmail
  if (draft.totpSecret !== account.totp_secret) patch.totpSecret = draft.totpSecret
  if (draft.notes !== account.notes) patch.notes = draft.notes
  return patch
}
