import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  AccountRow,
  AppPreferences,
  CreateTotpData,
  CsvImportResult,
  SecretFieldGroupRow,
  SecretFieldRow,
  SecretGroupRow,
  SecretServiceRow,
  ServiceInfoSortMode,
  TotpAccountRow,
  UpdateTotpData,
} from '../types'
import type { AccountPlatform } from '../utils/accountPlatform'
import { resolveAppPreferences } from '../utils/appPreferences'

type ActiveView = 'accounts' | '2fa' | 'trash' | 'service-info'

interface SelectedServiceDetail {
  service: SecretServiceRow
  fieldGroups: SecretFieldGroupRow[]
  fields: SecretFieldRow[]
}

interface AppState {
  totpAccounts: TotpAccountRow[]
  accounts: AccountRow[]
  allAccounts: AccountRow[]
  trashAccounts: AccountRow[]
  trashServices: SecretServiceRow[]

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
  navigationBlockReason: string | null

  accountsPinnedIds: string[]
  accountsCustomOrder: string[]

  setActiveView: (view: ActiveView) => void
  setSelectedAccount: (id: string | null) => void
  setAccountSearchQuery: (query: string) => void
  setAccountPlatformFilter: (platform: AccountPlatform | 'all') => void
  toggleTheme: () => void
  loadAppPreferences: () => Promise<AppPreferences>
  setNavigationBlockReason: (reason: string | null) => void

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
  loadAllAccounts: () => Promise<void>
  loadTrashAccounts: () => Promise<void>
  loadTrashServices: () => Promise<void>

  createTotpAccount: (data: Omit<CreateTotpData, 'id'>) => Promise<string>
  updateTotpAccount: (id: string, data: UpdateTotpData) => Promise<void>
  deleteTotpAccount: (id: string) => Promise<void>
  incrementTotpCounter: (id: string) => Promise<number>

  createAccount: (name: string, platform?: AccountPlatform) => Promise<string>
  updateAccount: (id: string, data: any, reload?: boolean) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  restoreAccount: (id: string) => Promise<void>
  hardDeleteAccount: (id: string) => Promise<void>
  restoreSecretService: (id: string) => Promise<void>
  hardDeleteSecretService: (id: string) => Promise<void>
  addAccountTag: (accountId: string, tagName: string) => Promise<void>
  removeAccountTag: (accountId: string, tagId: string) => Promise<void>
  navigateToAccount: (accountId: string) => void

  exportDatabase: () => Promise<{ success: boolean; filePath?: string }>
  importDatabase: () => Promise<{ success: boolean }>
  importCsvAccounts: () => Promise<CsvImportResult>
}

export const useStore = create<AppState>((set, get) => ({
  totpAccounts: [],
  accounts: [],
  allAccounts: [],
  trashAccounts: [],
  trashServices: [],
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
  navigationBlockReason: null,

  accountsPinnedIds: [],
  accountsCustomOrder: [],

  setActiveView: (view) => set({ activeView: view }),
  setSelectedAccount: (id) => set({ selectedAccountId: id }),
  setAccountSearchQuery: (accountSearchQuery) => set({ accountSearchQuery }),
  setAccountPlatformFilter: (accountPlatformFilter) => set({ accountPlatformFilter }),
  setNavigationBlockReason: (navigationBlockReason) => {
    window.electronAPI.setUnsavedChanges(Boolean(navigationBlockReason))
    set({ navigationBlockReason })
  },
  toggleTheme: () => set((state) => {
    const themeMode = state.themeMode === 'dark' ? 'light' : 'dark'
    void window.electronAPI.updateAppPreferences({ themeMode })
    return { themeMode }
  }),

  loadAppPreferences: async () => {
    const preferences = await window.electronAPI.getAppPreferences()
    let legacyPinnedIds: unknown = []
    let legacyCustomOrder: unknown = []
    try {
      legacyPinnedIds = JSON.parse(localStorage.getItem('accounts_pinned_ids') || '[]')
      legacyCustomOrder = JSON.parse(localStorage.getItem('accounts_custom_order') || '[]')
    } catch {
      // Ignore malformed legacy renderer preferences.
    }

    const {
      accountsPinnedIds,
      accountsCustomOrder,
      themeMode,
      serviceSortMode,
      needsAccountPreferenceMigration,
    } = resolveAppPreferences(preferences, legacyPinnedIds, legacyCustomOrder)

    set({ accountsPinnedIds, accountsCustomOrder, themeMode, serviceSortMode })

    if (needsAccountPreferenceMigration) {
      try {
        await window.electronAPI.updateAppPreferences({ accountsPinnedIds, accountsCustomOrder })
        localStorage.removeItem('accounts_pinned_ids')
        localStorage.removeItem('accounts_custom_order')
      } catch (error) {
        console.error('Failed to migrate legacy account preferences:', error)
      }
    }
    return preferences
  },

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
  setServiceSortMode: (serviceSortMode) => {
    set({ serviceSortMode })
    void window.electronAPI.updateAppPreferences({ serviceSortMode })
  },
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
      void window.electronAPI.updateAppPreferences({ accountsPinnedIds })
      return { accountsPinnedIds }
    })
  },
  updateAccountsCustomOrder: (order) => {
    set({ accountsCustomOrder: order })
    void window.electronAPI.updateAppPreferences({ accountsCustomOrder: order })
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

  loadAllAccounts: async () => {
    const allAccounts = await window.electronAPI.getAccounts({
      isDeleted: false,
      platform: 'all',
    })
    set({ allAccounts })
  },

  loadTrashAccounts: async () => {
    const trashAccounts = await window.electronAPI.getAccounts({
      isDeleted: true,
      platform: 'all',
    })
    set({ trashAccounts })
  },

  loadTrashServices: async () => {
    const trashServices = await window.electronAPI.getDeletedSecretServices()
    set({ trashServices })
  },

  createTotpAccount: async (data) => {
    const id = uuidv4()
    await window.electronAPI.createTotpAccount({
      id,
      ...data,
      otpType: data.otpType || 'totp',
    })
    await get().loadTotpAccounts()
    return id
  },

  updateTotpAccount: async (id, data) => {
    await window.electronAPI.updateTotpAccount(id, data)
    await get().loadTotpAccounts()
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
    await Promise.all([get().loadAccounts(), get().loadAllAccounts()])
    set({ selectedAccountId: id })
    return id
  },

  updateAccount: async (id, data, reload = true) => {
    await window.electronAPI.updateAccount(id, data)
    if (reload) {
      await Promise.all([get().loadAccounts(), get().loadAllAccounts()])
    }
  },

  deleteAccount: async (id) => {
    await window.electronAPI.deleteAccount(id)
    if (get().selectedAccountId === id) {
      set({ selectedAccountId: null })
    }
    await Promise.all([get().loadAccounts(), get().loadAllAccounts(), get().loadTrashAccounts()])
  },

  restoreAccount: async (id) => {
    await window.electronAPI.restoreAccount(id)
    await Promise.all([get().loadAccounts(), get().loadAllAccounts(), get().loadTrashAccounts()])
  },

  hardDeleteAccount: async (id) => {
    await window.electronAPI.hardDeleteAccount(id)
    await Promise.all([get().loadTrashAccounts(), get().loadAllAccounts()])
  },

  restoreSecretService: async (id) => {
    await window.electronAPI.restoreSecretService(id)
    await get().loadServiceInfo()
    await get().loadTrashServices()
  },

  hardDeleteSecretService: async (id) => {
    await window.electronAPI.hardDeleteSecretService(id)
    await get().loadTrashServices()
  },

  addAccountTag: async (accountId, tagName) => {
    await window.electronAPI.addAccountTag({ accountId, tagName })
    await Promise.all([get().loadAccounts(), get().loadAllAccounts()])
  },

  removeAccountTag: async (accountId, tagId) => {
    await window.electronAPI.removeAccountTag({ accountId, tagId })
    await Promise.all([get().loadAccounts(), get().loadAllAccounts()])
  },

  navigateToAccount: (accountId) => {
    set({
      activeView: 'accounts',
      selectedAccountId: accountId,
      accountSearchQuery: '',
      accountPlatformFilter: 'all',
    })
  },

  exportDatabase: async () => {
    return window.electronAPI.exportDatabase()
  },

  importDatabase: async () => {
    const result = await window.electronAPI.importDatabase()
    if (result.success) {
      await get().loadTotpAccounts()
      await get().loadAccounts()
      await get().loadAllAccounts()
      await get().loadTrashAccounts()
      await get().loadServiceInfo()
      await get().loadTrashServices()
    }
    return result
  },

  importCsvAccounts: async () => {
    const result = await window.electronAPI.importCsvAccounts()
    if (result.count > 0) {
      await Promise.all([get().loadAccounts(), get().loadAllAccounts(), get().loadTotpAccounts()])
    }
    return result
  },
}))
