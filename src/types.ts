export interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>

  getPrompts: (filters?: PromptFilters) => Promise<PromptRow[]>
  getPromptById: (id: string) => Promise<PromptRow | null>
  createPrompt: (data: CreatePromptData) => Promise<{ id: string }>
  updatePrompt: (id: string, data: UpdatePromptData) => Promise<{ success: boolean }>
  deletePrompt: (id: string) => Promise<{ success: boolean }>

  getFolders: () => Promise<FolderRow[]>
  createFolder: (data: CreateFolderData) => Promise<{ id: string }>
  updateFolder: (id: string, data: Partial<FolderRow>) => Promise<{ success: boolean }>
  deleteFolder: (id: string) => Promise<{ success: boolean }>

  getTags: () => Promise<TagRow[]>
  createTag: (data: CreateTagData) => Promise<{ id: string }>
  updateTag: (id: string, data: Partial<TagRow>) => Promise<{ success: boolean }>
  deleteTag: (id: string) => Promise<{ success: boolean }>

  // TOTP 2FA
  getTotpAccounts: () => Promise<TotpAccountRow[]>
  createTotpAccount: (data: CreateTotpData) => Promise<{ id: string }>
  updateTotpAccount: (id: string, data: Partial<TotpAccountRow>) => Promise<{ success: boolean }>
  deleteTotpAccount: (id: string) => Promise<{ success: boolean }>
  incrementTotpCounter: (id: string) => Promise<{ counter: number }>

  // Accounts
  getAccounts: (filters?: AccountFilters) => Promise<AccountRow[]>
  getAccountById: (id: string) => Promise<AccountRow | null>
  createAccount: (data: CreateAccountData) => Promise<{ id: string }>
  updateAccount: (id: string, data: UpdateAccountData) => Promise<{ success: boolean }>
  deleteAccount: (id: string) => Promise<{ success: boolean }>

  // Custom Fields
  addAccountField: (data: { id: string; accountId: string; fieldName: string; fieldValue: string; isSecret: boolean }) => Promise<{ id: string }>
  updateAccountField: (id: string, data: { fieldName?: string; fieldValue?: string; isSecret?: boolean }) => Promise<{ success: boolean }>
  deleteAccountField: (id: string) => Promise<{ success: boolean }>

  exportDatabase: () => Promise<{ success: boolean; filePath?: string }>
  importDatabase: () => Promise<{ success: boolean }>
}

export interface PromptRow {
  id: string
  title: string
  content: string
  folder_id: string | null
  is_favorite: number
  created_at: string
  updated_at: string
  tag_ids: string | null
}

export interface FolderRow {
  id: string
  name: string
  parent_id: string | null
  sort_order: number
  created_at: string
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

export interface AccountRow {
  id: string
  name: string
  username: string
  password: string
  phone: string
  backup_email: string
  totp_secret: string
  notes: string
  folder_id: string | null
  is_favorite: number
  created_at: string
  updated_at: string
  customFields?: CustomFieldRow[]
}

export interface CustomFieldRow {
  id: string
  account_id: string
  field_name: string
  field_value: string
  is_secret: number
  sort_order: number
}

export interface AccountFilters {
  search?: string
  favoritesOnly?: boolean
}

export interface CreateAccountData {
  id: string
  name: string
  username?: string
  password?: string
  phone?: string
  backupEmail?: string
  totpSecret?: string
  notes?: string
}

export interface UpdateAccountData {
  name?: string
  username?: string
  password?: string
  phone?: string
  backupEmail?: string
  totpSecret?: string
  notes?: string
  isFavorite?: number
}

export interface PromptFilters {
  folderId?: string
  tagId?: string
  search?: string
  favoritesOnly?: boolean
}

export interface CreatePromptData {
  id: string
  title: string
  content: string
  folderId?: string
  tags?: string[]
}

export interface UpdatePromptData {
  title?: string
  content?: string
  folderId?: string | null
  tags?: string[]
  isFavorite?: number
}

export interface CreateFolderData {
  id: string
  name: string
  parentId?: string
}

export interface CreateTagData {
  id: string
  name: string
  color: string
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
