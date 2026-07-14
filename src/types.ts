import type { AccountPlatform } from './utils/accountPlatform'

export interface AppPreferences {
  sidebarWidth?: number
  sidebarCollapsed?: boolean
  accountsListWidth?: number
  twoFactorAlignment?: 'left' | 'center'
  themeMode?: 'dark' | 'light'
  accountsPinnedIds?: string[]
  accountsCustomOrder?: string[]
  serviceSortMode?: ServiceInfoSortMode
}

export interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  setUnsavedChanges: (hasUnsavedChanges: boolean) => void

  getTotpAccounts: () => Promise<TotpAccountRow[]>
  createTotpAccount: (data: CreateTotpData) => Promise<{ id: string }>
  updateTotpAccount: (id: string, data: UpdateTotpData) => Promise<{ success: boolean }>
  deleteTotpAccount: (id: string) => Promise<{ success: boolean }>
  incrementTotpCounter: (id: string) => Promise<{ counter: number }>

  getAccounts: (filters?: AccountFilters) => Promise<AccountRow[]>
  getAccountById: (id: string) => Promise<AccountRow | null>
  createAccount: (data: CreateAccountData) => Promise<{ id: string }>
  updateAccount: (id: string, data: UpdateAccountData) => Promise<{ success: boolean }>
  deleteAccount: (id: string) => Promise<{ success: boolean }>
  restoreAccount: (id: string) => Promise<{ success: boolean }>
  hardDeleteAccount: (id: string) => Promise<{ success: boolean }>
  importCsvAccounts: () => Promise<CsvImportResult>
  addAccountTag: (data: { accountId: string; tagName: string; color?: string }) => Promise<{ tagId: string }>
  removeAccountTag: (data: { accountId: string; tagId: string }) => Promise<{ success: boolean }>

  addAccountField: (data: { id: string; accountId: string; fieldName: string; fieldValue: string; isSecret: boolean }) => Promise<{ id: string }>
  updateAccountField: (id: string, data: { fieldName?: string; fieldValue?: string; isSecret?: boolean }) => Promise<{ success: boolean }>
  deleteAccountField: (id: string) => Promise<{ success: boolean }>

  getServiceInfo: () => Promise<ServiceInfoPayload>
  getServiceDetail: (serviceId: string) => Promise<ServiceDetailPayload | null>
  createSecretGroup: (data: { id: string; name: string; color?: string }) => Promise<{ id: string }>
  updateSecretGroup: (id: string, data: { name?: string; color?: string; isCollapsed?: number; sortOrder?: number }) => Promise<{ success: boolean }>
  deleteSecretGroup: (id: string) => Promise<{ success: boolean }>
  createSecretService: (data: CreateSecretServiceData) => Promise<{ id: string }>
  updateSecretService: (id: string, data: UpdateSecretServiceData) => Promise<{ success: boolean }>
  deleteSecretService: (id: string) => Promise<{ success: boolean }>
  getDeletedSecretServices: () => Promise<SecretServiceRow[]>
  restoreSecretService: (id: string) => Promise<{ success: boolean }>
  hardDeleteSecretService: (id: string) => Promise<{ success: boolean }>
  moveSecretServices: (data: { ids: string[]; groupId: string | null }) => Promise<{ success: boolean }>
  reorderSecretServices: (data: { orderedIds: string[]; groupId: string | null }) => Promise<{ success: boolean }>
  createSecretFieldGroup: (data: { id: string; serviceId: string; name: string; color?: string }) => Promise<{ id: string }>
  updateSecretFieldGroup: (id: string, data: { name?: string; color?: string; isCollapsed?: number; sortOrder?: number }) => Promise<{ success: boolean }>
  deleteSecretFieldGroup: (id: string) => Promise<{ success: boolean }>
  createSecretField: (data: CreateSecretFieldData) => Promise<{ id: string }>
  updateSecretField: (id: string, data: UpdateSecretFieldData) => Promise<{ success: boolean }>
  deleteSecretField: (id: string) => Promise<{ success: boolean }>
  moveSecretFields: (data: { ids: string[]; groupId: string | null }) => Promise<{ success: boolean }>
  reorderSecretFields: (data: { orderedIds: string[]; groupId: string | null }) => Promise<{ success: boolean }>
  openDataDirectory: () => Promise<{ success: boolean }>
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>
  getAppPreferences: () => Promise<AppPreferences>
  updateAppPreferences: (patch: Partial<AppPreferences>) => Promise<AppPreferences>
  resetAppPreferences: () => Promise<AppPreferences>
  getVersion: () => Promise<string>
  checkUpdates: () => Promise<{ success: boolean; error?: string; isPortable?: boolean; status?: string; result?: unknown }>
  downloadUpdate: () => Promise<{ success: boolean; error?: string; isPortable?: boolean; status?: string }>
  quitAndInstall: () => Promise<boolean>
  onUpdateMessage: (callback: (message: UpdateMessage) => void) => () => void

  exportDatabase: () => Promise<{ success: boolean; filePath?: string }>
  importDatabase: () => Promise<{ success: boolean }>
}

export interface UpdateMessage {
  status: 'checking' | 'available' | 'latest' | 'error' | 'downloading' | 'downloaded' | 'portable'
  version?: string
  error?: string
  isPortable?: boolean
  percent?: number
  bytesPerSecond?: number
  transferred?: number
  total?: number
  info?: unknown
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

export type ServiceInfoSortMode =
  | 'manual'
  | 'name-asc'
  | 'name-desc'
  | 'updated-desc'
  | 'updated-asc'
  | 'favorites-first'
  | 'random'

export interface SecretGroupRow {
  id: string
  name: string
  color: string
  sort_order: number
  is_collapsed: number
  created_at: string
  updated_at: string
}

export interface SecretServiceRow {
  id: string
  group_id: string | null
  linked_account_id: string | null
  name: string
  description: string
  url: string
  notes: string
  is_favorite: number
  is_deleted: number
  deleted_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SecretFieldGroupRow {
  id: string
  service_id: string
  name: string
  color: string
  sort_order: number
  is_collapsed: number
  created_at: string
  updated_at: string
}

export interface SecretFieldRow {
  id: string
  service_id: string
  group_id: string | null
  field_name: string
  field_value: string
  is_secret: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ServiceInfoPayload {
  groups: SecretGroupRow[]
  services: SecretServiceRow[]
}

export interface ServiceDetailPayload {
  service: SecretServiceRow
  fieldGroups: SecretFieldGroupRow[]
  fields: SecretFieldRow[]
}

export interface CreateSecretServiceData {
  id: string
  name: string
  groupId?: string | null
  description?: string
  url?: string
  notes?: string
  linkedAccountId?: string | null
}

export interface UpdateSecretServiceData {
  groupId?: string | null
  linkedAccountId?: string | null
  name?: string
  description?: string
  url?: string
  notes?: string
  isFavorite?: number
}

export interface CreateSecretFieldData {
  id: string
  serviceId: string
  groupId?: string | null
  fieldName: string
  fieldValue?: string
  isSecret?: boolean
}

export interface UpdateSecretFieldData {
  groupId?: string | null
  fieldName?: string
  fieldValue?: string
  isSecret?: boolean
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

export interface CsvImportResult {
  count: number
  invalidTotpCount: number
  skippedRowCount: number
}

export interface UpdateTotpData {
  issuer?: string
  label?: string
  secret?: string
  algorithm?: string
  digits?: number
  period?: number
  otpType?: string
  counter?: number
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
