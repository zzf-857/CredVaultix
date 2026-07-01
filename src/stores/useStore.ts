import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  AccountRow,
  SecretFieldGroupRow,
  SecretFieldRow,
  SecretGroupRow,
  SecretServiceRow,
  ServiceInfoSortMode,
  TotpAccountRow,
} from '../types'
import type { AccountPlatform } from '../utils/accountPlatform'

type ActiveView = 'accounts' | '2fa' | 'trash' | 'service-info'

interface SelectedServiceDetail {
  service: SecretServiceRow
  fieldGroups: SecretFieldGroupRow[]
  fields: SecretFieldRow[]
}

interface AppState {
  totpAccounts: TotpAccountRow[]
  accounts: AccountRow[]
  trashAccounts: AccountRow[]

  serviceGroups: SecretGroupRow[]
  secretServices: SecretServiceRow[]
  selectedServiceId: string | null
  selectedServiceDetail: SelectedServiceDetail | null
  serviceSearchQuery: string
  serviceSortMode: ServiceInfoSortMode
  selectedServiceIds: string[]
  selectedFieldIds: string[]

  activeView: ActiveView
  selectedAccountId: string | null
  accountSearchQuery: string
  accountPlatformFilter: AccountPlatform | 'all'
  themeMode: 'dark' | 'light'

  accountsPinnedIds: string[]
  accountsCustomOrder: string[]

  setActiveView: (view: ActiveView) => void
  setSelectedAccount: (id: string | null) => void
  setAccountSearchQuery: (query: string) => void
  setAccountPlatformFilter: (platform: AccountPlatform | 'all') => void
  toggleTheme: () => void

  loadServiceInfo: () => Promise<void>
  loadServiceDetail: (serviceId: string) => Promise<void>
  setSelectedService: (id: string | null) => void
  setServiceSearchQuery: (query: string) => void
  setServiceSortMode: (mode: ServiceInfoSortMode) => void
  toggleSelectedServiceId: (id: string) => void
  clearSelectedServiceIds: () => void
  toggleSelectedFieldId: (id: string) => void
  clearSelectedFieldIds: () => void

  togglePinAccount: (id: string) => void
  updateAccountsCustomOrder: (order: string[]) => void

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
  serviceGroups: [],
  secretServices: [],
  selectedServiceId: null,
  selectedServiceDetail: null,
  serviceSearchQuery: '',
  serviceSortMode: 'manual',
  selectedServiceIds: [],
  selectedFieldIds: [],
  activeView: 'accounts',
  selectedAccountId: null,
  accountSearchQuery: '',
  accountPlatformFilter: 'all',
  themeMode: 'dark',

  accountsPinnedIds: (() => {
    try {
      const saved = localStorage.getItem('accounts_pinned_ids')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })(),
  accountsCustomOrder: (() => {
    try {
      const saved = localStorage.getItem('accounts_custom_order')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })(),

  setActiveView: (view) => set({ activeView: view }),
  setSelectedAccount: (id) => set({ selectedAccountId: id }),
  setAccountSearchQuery: (accountSearchQuery) => set({ accountSearchQuery }),
  setAccountPlatformFilter: (accountPlatformFilter) => set({ accountPlatformFilter }),
  toggleTheme: () => set((state) => ({ themeMode: state.themeMode === 'dark' ? 'light' : 'dark' })),

  loadServiceInfo: async () => {
    const { groups, services } = await window.electronAPI.getServiceInfo()
    const state = get()
    const selectedServiceExists = state.selectedServiceId
      ? services.some((service) => service.id === state.selectedServiceId)
      : false
    const serviceIds = new Set(services.map((service) => service.id))

    set({
      serviceGroups: groups,
      secretServices: services,
      selectedServiceId: selectedServiceExists ? state.selectedServiceId : null,
      selectedServiceDetail: selectedServiceExists ? state.selectedServiceDetail : null,
      selectedServiceIds: state.selectedServiceIds.filter((id) => serviceIds.has(id)),
    })
  },

  loadServiceDetail: async (serviceId) => {
    const detail = await window.electronAPI.getServiceDetail(serviceId)

    set((state) => {
      if (state.selectedServiceId && state.selectedServiceId !== serviceId) {
        return {}
      }

      const fieldIds = new Set((detail?.fields || []).map((field) => field.id))
      return {
        selectedServiceId: detail ? serviceId : null,
        selectedServiceDetail: detail,
        selectedFieldIds: state.selectedFieldIds.filter((id) => fieldIds.has(id)),
      }
    })
  },

  setSelectedService: (id) => {
    set({ selectedServiceId: id, selectedServiceDetail: null, selectedFieldIds: [] })
    if (id) {
      void get().loadServiceDetail(id)
    }
  },

  setServiceSearchQuery: (serviceSearchQuery) => set({ serviceSearchQuery }),
  setServiceSortMode: (serviceSortMode) => set({ serviceSortMode }),
  toggleSelectedServiceId: (id) => {
    set((state) => ({
      selectedServiceIds: state.selectedServiceIds.includes(id)
        ? state.selectedServiceIds.filter((selectedId) => selectedId !== id)
        : [...state.selectedServiceIds, id],
    }))
  },
  clearSelectedServiceIds: () => set({ selectedServiceIds: [] }),
  toggleSelectedFieldId: (id) => {
    set((state) => ({
      selectedFieldIds: state.selectedFieldIds.includes(id)
        ? state.selectedFieldIds.filter((selectedId) => selectedId !== id)
        : [...state.selectedFieldIds, id],
    }))
  },
  clearSelectedFieldIds: () => set({ selectedFieldIds: [] }),

  togglePinAccount: (id) => {
    set((state) => {
      const accountsPinnedIds = state.accountsPinnedIds.includes(id)
        ? state.accountsPinnedIds.filter(x => x !== id)
        : [...state.accountsPinnedIds, id]
      try {
        localStorage.setItem('accounts_pinned_ids', JSON.stringify(accountsPinnedIds))
      } catch (err) {
        console.error('Failed to save accounts pinned ids:', err)
      }
      return { accountsPinnedIds }
    })
  },
  updateAccountsCustomOrder: (order) => {
    set({ accountsCustomOrder: order })
    try {
      localStorage.setItem('accounts_custom_order', JSON.stringify(order))
    } catch (err) {
      console.error('Failed to save accounts custom order:', err)
    }
  },

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
      await get().loadServiceInfo()
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
