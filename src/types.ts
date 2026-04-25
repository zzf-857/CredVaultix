import type { AccountPlatform } from './utils/accountPlatform'

export interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>

  getTotpAccounts: () => Promise<TotpAccountRow[]>
  createTotpAccount: (data: CreateTotpData) => Promise<{ id: string }>
  updateTotpAccount: (id: string, data: Partial<TotpAccountRow>) => Promise<{ success: boolean }>
  deleteTotpAccount: (id: string) => Promise<{ success: boolean }>
  incrementTotpCounter: (id: string) => Promise<{ counter: number }>

  getAccounts: (filters?: AccountFilters) => Promise<AccountRow[]>
  getAccountById: (id: string) => Promise<AccountRow | null>
  createAccount: (data: CreateAccountData) => Promise<{ id: string }>
  updateAccount: (id: string, data: UpdateAccountData) => Promise<{ success: boolean }>
  deleteAccount: (id: string) => Promise<{ success: boolean }>
  restoreAccount: (id: string) => Promise<{ success: boolean }>
  hardDeleteAccount: (id: string) => Promise<{ success: boolean }>
  importCsvAccounts: () => Promise<{ count: number }>
  addAccountTag: (data: { accountId: string; tagName: string; color?: string }) => Promise<{ tagId: string }>
  removeAccountTag: (data: { accountId: string; tagId: string }) => Promise<{ success: boolean }>

  addAccountField: (data: { id: string; accountId: string; fieldName: string; fieldValue: string; isSecret: boolean }) => Promise<{ id: string }>
  updateAccountField: (id: string, data: { fieldName?: string; fieldValue?: string; isSecret?: boolean }) => Promise<{ success: boolean }>
  deleteAccountField: (id: string) => Promise<{ success: boolean }>

  exportDatabase: () => Promise<{ success: boolean; filePath?: string }>
  importDatabase: () => Promise<{ success: boolean }>
}

export interface TagRow {
  id: string
  name: string
  color: string
}

export interface TotpAccountRow {
  id: string
  issuer: string
  label: string
  secret: string
  algorithm: string
  digits: number
  period: number
  otp_type: string
  counter: number
  linked_account_id: string | null
  sort_order: number
  created_at: string
}

export interface CustomFieldRow {
  id: string
  account_id: string
  field_name: string
  field_value: string
  is_secret: number
  sort_order: number
}

export interface AccountRow {
  id: string
  name: string
  username: string
  password: string
  phone: string
  backup_email: string
  totp_secret: string
  notes: string
  platform: AccountPlatform
  is_favorite: number
  is_deleted?: number
  deleted_at?: string | null
  created_at: string
  updated_at: string
  tags?: TagRow[]
  customFields?: CustomFieldRow[]
}

export interface AccountFilters {
  search?: string
  favoritesOnly?: boolean
  isDeleted?: boolean
  platform?: AccountPlatform | 'all'
}

export interface CreateAccountData {
  id: string
  name: string
  platform?: AccountPlatform
  username?: string
  password?: string
  phone?: string
  backupEmail?: string
  totpSecret?: string
  notes?: string
}

export interface UpdateAccountData {
  name?: string
  platform?: AccountPlatform
  username?: string
  password?: string
  phone?: string
  backupEmail?: string
  totpSecret?: string
  notes?: string
  isFavorite?: number
}

export interface CreateTotpData {
  id: string
  issuer: string
  label: string
  secret: string
  algorithm?: string
  digits?: number
  period?: number
  otpType?: string
  counter?: number
  linkedAccountId?: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
