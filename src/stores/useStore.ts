import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { AccountRow, TotpAccountRow } from '../types'
import type { AccountPlatform } from '../utils/accountPlatform'

interface AppState {
  totpAccounts: TotpAccountRow[]
  accounts: AccountRow[]
  trashAccounts: AccountRow[]

  activeView: 'accounts' | '2fa' | 'trash'
  selectedAccountId: string | null
  accountSearchQuery: string
  accountPlatformFilter: AccountPlatform | 'all'
  themeMode: 'dark' | 'light'

  setActiveView: (view: 'accounts' | '2fa' | 'trash') => void
  setSelectedAccount: (id: string | null) => void
  setAccountSearchQuery: (query: string) => void
  setAccountPlatformFilter: (platform: AccountPlatform | 'all') => void
  toggleTheme: () => void

  loadTotpAccounts: () => Promise<void>
  loadAccounts: () => Promise<void>
  loadTrashAccounts: () => Promise<void>

  createTotpAccount: (issuer: string, label: string, secret: string, otpType?: string, linkedAccountId?: string) => Promise<string>
  deleteTotpAccount: (id: string) => Promise<void>
  incrementTotpCounter: (id: string) => Promise<number>

  createAccount: (name: string, platform?: AccountPlatform) => Promise<string>
  updateAccount: (id: string, data: any) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  restoreAccount: (id: string) => Promise<void>
  hardDeleteAccount: (id: string) => Promise<void>
  addAccountTag: (accountId: string, tagName: string) => Promise<void>
  removeAccountTag: (accountId: string, tagId: string) => Promise<void>
  navigateToAccount: (accountId: string) => void

  exportDatabase: () => Promise<void>
  importDatabase: () => Promise<void>
  importCsvAccounts: () => Promise<number>
}

export const useStore = create<AppState>((set, get) => ({
  totpAccounts: [],
  accounts: [],
  trashAccounts: [],
  activeView: 'accounts',
  selectedAccountId: null,
  accountSearchQuery: '',
  accountPlatformFilter: 'all',
  themeMode: 'dark',

  setActiveView: (view) => set({ activeView: view }),
  setSelectedAccount: (id) => set({ selectedAccountId: id }),
  setAccountSearchQuery: (accountSearchQuery) => set({ accountSearchQuery }),
  setAccountPlatformFilter: (accountPlatformFilter) => set({ accountPlatformFilter }),
  toggleTheme: () => set((state) => ({ themeMode: state.themeMode === 'dark' ? 'light' : 'dark' })),

  loadTotpAccounts: async () => {
    const totpAccounts = await window.electronAPI.getTotpAccounts()
    set({ totpAccounts })
  },

  loadAccounts: async () => {
    const state = get()
    const accounts = await window.electronAPI.getAccounts({
      search: state.accountSearchQuery || undefined,
      platform: state.accountPlatformFilter,
      isDeleted: false,
    })

    const selectedAccountId = state.selectedAccountId
    set({
      accounts,
      selectedAccountId:
        selectedAccountId && !accounts.some((account) => account.id === selectedAccountId)
          ? null
          : selectedAccountId,
    })
  },

  loadTrashAccounts: async () => {
    const state = get()
    const trashAccounts = await window.electronAPI.getAccounts({
      search: state.accountSearchQuery || undefined,
      platform: state.accountPlatformFilter,
      isDeleted: true,
    })
    set({ trashAccounts })
  },

  createTotpAccount: async (issuer, label, secret, otpType, linkedAccountId) => {
    const id = uuidv4()
    await window.electronAPI.createTotpAccount({
      id,
      issuer,
      label,
      secret,
      otpType: otpType || 'totp',
      linkedAccountId,
    })
    await get().loadTotpAccounts()
    return id
  },

  deleteTotpAccount: async (id) => {
    await window.electronAPI.deleteTotpAccount(id)
    await get().loadTotpAccounts()
  },

  incrementTotpCounter: async (id) => {
    const result = await window.electronAPI.incrementTotpCounter(id)
    await get().loadTotpAccounts()
    return result.counter
  },

  createAccount: async (name, platform = 'google') => {
    const id = uuidv4()
    await window.electronAPI.createAccount({ id, name, platform })
    await get().loadAccounts()
    set({ selectedAccountId: id })
    return id
  },

  updateAccount: async (id, data) => {
    await window.electronAPI.updateAccount(id, data)
    await get().loadAccounts()
  },

  deleteAccount: async (id) => {
    await window.electronAPI.deleteAccount(id)
    if (get().selectedAccountId === id) {
      set({ selectedAccountId: null })
    }
    await get().loadAccounts()
    await get().loadTrashAccounts()
  },

  restoreAccount: async (id) => {
    await window.electronAPI.restoreAccount(id)
    await get().loadAccounts()
    await get().loadTrashAccounts()
  },

  hardDeleteAccount: async (id) => {
    await window.electronAPI.hardDeleteAccount(id)
    await get().loadTrashAccounts()
  },

  addAccountTag: async (accountId, tagName) => {
    await window.electronAPI.addAccountTag({ accountId, tagName })
    await get().loadAccounts()
  },

  removeAccountTag: async (accountId, tagId) => {
    await window.electronAPI.removeAccountTag({ accountId, tagId })
    await get().loadAccounts()
  },

  navigateToAccount: (accountId) => {
    set({ activeView: 'accounts', selectedAccountId: accountId })
  },

  exportDatabase: async () => {
    await window.electronAPI.exportDatabase()
  },

  importDatabase: async () => {
    const result = await window.electronAPI.importDatabase()
    if (result.success) {
      await get().loadTotpAccounts()
      await get().loadAccounts()
      await get().loadTrashAccounts()
    }
  },

  importCsvAccounts: async () => {
    const result = await window.electronAPI.importCsvAccounts()
    if (result.count > 0) {
      await get().loadAccounts()
    }
    return result.count
  },
}))
