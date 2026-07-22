import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  AccountRow,
  AppPreferences,
  AccountUpdateResult,
  CreateTotpData,
  CsvImportResult,
  SecretFieldGroupRow,
  SecretFieldRow,
  SecretGroupRow,
  SecretServiceRow,
  ServiceInfoSortMode,
  TotpAccountRow,
  UpdateTotpData,
  UpdateAccountData,
} from '../types'
import type { AccountPlatform } from '../utils/accountPlatform'
import { resolveAppPreferences } from '../utils/appPreferences'

type ActiveView = 'accounts' | '2fa' | 'trash' | 'service-info'

interface SelectedServiceDetail {
  service: SecretServiceRow
  fieldGroups: SecretFieldGroupRow[]
  fields: SecretFieldRow[]
}

interface MutationRefreshResult {
  refreshFailed: boolean
}

async function settleRefreshes(label: string, refreshes: Promise<unknown>[]) {
  const results = await Promise.allSettled(refreshes)
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (failures.length > 0) {
    console.error(`${label} committed, but ${failures.length} refresh operation(s) failed`, failures.map((failure) => failure.reason))
  }
  return failures.length > 0
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
  serviceDetailLoadError: string | null
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
  dataRevision: number

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

  createTotpAccount: (data: Omit<CreateTotpData, 'id'>) => Promise<{ id: string } & MutationRefreshResult>
  updateTotpAccount: (id: string, data: UpdateTotpData) => Promise<MutationRefreshResult>
  deleteTotpAccount: (id: string) => Promise<MutationRefreshResult>
  incrementTotpCounter: (id: string) => Promise<{ counter: number } & MutationRefreshResult>

  createAccount: (name: string, platform?: AccountPlatform) => Promise<{ id: string } & MutationRefreshResult>
  updateAccount: (id: string, data: UpdateAccountData, reload?: boolean) => Promise<AccountUpdateResult>
  deleteAccount: (id: string) => Promise<MutationRefreshResult>
  restoreAccount: (id: string) => Promise<MutationRefreshResult>
  hardDeleteAccount: (id: string) => Promise<MutationRefreshResult>
  restoreSecretService: (id: string) => Promise<MutationRefreshResult>
  hardDeleteSecretService: (id: string) => Promise<MutationRefreshResult>
  addAccountTag: (accountId: string, tagName: string) => Promise<{ tagId: string; linked?: boolean } & MutationRefreshResult>
  removeAccountTag: (accountId: string, tagId: string) => Promise<{ success: boolean; removed?: boolean; deletedUnusedTag?: boolean } & MutationRefreshResult>
  navigateToAccount: (accountId: string) => void

  exportDatabase: () => Promise<{ success: boolean; filePath?: string }>
  importDatabase: () => Promise<{ success: boolean; refreshFailed?: boolean }>
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
  serviceDetailLoadError: null,
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
  dataRevision: 0,

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
    const selectedService = state.selectedServiceId
      ? services.find((service) => service.id === state.selectedServiceId)
      : undefined
    const selectedServiceExists = Boolean(selectedService)
    const serviceIds = new Set(services.map((service) => service.id))

    set({
      serviceGroups: groups,
      secretServices: services,
      selectedServiceId: selectedServiceExists ? state.selectedServiceId : null,
      selectedServiceDetail: selectedService && state.selectedServiceDetail
        ? {
            ...state.selectedServiceDetail,
            service: { ...state.selectedServiceDetail.service, ...selectedService },
          }
        : selectedServiceExists ? state.selectedServiceDetail : null,
      serviceDetailLoadError: selectedServiceExists ? state.serviceDetailLoadError : null,
      selectedServiceIds: state.selectedServiceIds.filter((id) => serviceIds.has(id)),
    })
  },

  loadServiceDetail: async (serviceId) => {
    let detail: SelectedServiceDetail | null
    try {
      detail = await window.electronAPI.getServiceDetail(serviceId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set((state) => state.selectedServiceId === serviceId
        ? { serviceDetailLoadError: `读取服务详情失败：${message}` }
        : {})
      throw error
    }

    set((state) => {
      if (state.selectedServiceId && state.selectedServiceId !== serviceId) {
        return {}
      }

      const fieldIds = new Set((detail?.fields || []).map((field) => field.id))
      return {
        selectedServiceId: detail ? serviceId : null,
        selectedServiceDetail: detail,
        serviceDetailLoadError: null,
        selectedFieldIds: state.selectedFieldIds.filter((id) => fieldIds.has(id)),
      }
    })
  },

  setSelectedService: (id) => {
    set({ selectedServiceId: id, selectedServiceDetail: null, selectedFieldIds: [], serviceDetailLoadError: null })
    if (id) {
      void get().loadServiceDetail(id).catch(() => undefined)
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

    const latestState = get()
    const selectedAccountId = latestState.selectedAccountId
    const preserveSelectedDraft = Boolean(latestState.navigationBlockReason)
    set({
      accounts,
      selectedAccountId:
        selectedAccountId
        && !preserveSelectedDraft
        && !accounts.some((account) => account.id === selectedAccountId)
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
    const result = await window.electronAPI.createTotpAccount({
      id,
      ...data,
      otpType: data.otpType || 'totp',
    })
    const refreshFailed = await settleRefreshes('2FA create', [get().loadTotpAccounts(), get().loadAccounts(), get().loadAllAccounts()])
    return { id: result.id, refreshFailed }
  },

  updateTotpAccount: async (id, data) => {
    const result = await window.electronAPI.updateTotpAccount(id, data)
    if (!result.success) throw new Error('2FA 记录不存在或已经删除')
    const refreshFailed = await settleRefreshes('2FA update', [get().loadTotpAccounts(), get().loadAccounts(), get().loadAllAccounts()])
    return { refreshFailed }
  },

  deleteTotpAccount: async (id) => {
    const result = await window.electronAPI.deleteTotpAccount(id)
    if (!result.success) throw new Error('2FA 记录不存在或已经删除')
    const refreshFailed = await settleRefreshes('2FA delete', [get().loadTotpAccounts(), get().loadAccounts(), get().loadAllAccounts()])
    return { refreshFailed }
  },

  incrementTotpCounter: async (id) => {
    const result = await window.electronAPI.incrementTotpCounter(id)
    if (!result.success) throw new Error('HOTP 记录不存在、已被删除或不是计数器验证码')
    const refreshFailed = await settleRefreshes('HOTP counter increment', [get().loadTotpAccounts()])
    return { counter: result.counter, refreshFailed }
  },

  createAccount: async (name, platform = 'google') => {
    const id = uuidv4()
    await window.electronAPI.createAccount({ id, name, platform })
    const refreshFailed = await settleRefreshes('account create', [get().loadAccounts(), get().loadAllAccounts()])
    set({ selectedAccountId: id })
    return { id, refreshFailed }
  },

  updateAccount: async (id, data, reload = true) => {
    const result = await window.electronAPI.updateAccount(id, data)
    let refreshFailed = false
    if (reload) {
      refreshFailed = await settleRefreshes('account update', [get().loadAccounts(), get().loadAllAccounts(), get().loadTotpAccounts()])
    }
    return { ...result, refreshFailed }
  },

  deleteAccount: async (id) => {
    const result = await window.electronAPI.deleteAccount(id)
    if (!result.success) throw new Error('账号不存在或已经在回收站中')
    set((state) => ({
      accounts: state.accounts.filter((account) => account.id !== id),
      allAccounts: state.allAccounts.filter((account) => account.id !== id),
      selectedAccountId: state.selectedAccountId === id ? null : state.selectedAccountId,
    }))
    const refreshFailed = await settleRefreshes('account delete', [get().loadAccounts(), get().loadAllAccounts(), get().loadTrashAccounts(), get().loadTotpAccounts()])
    return { refreshFailed }
  },

  restoreAccount: async (id) => {
    const result = await window.electronAPI.restoreAccount(id)
    if (!result.success) throw new Error('账号不存在或已经恢复')
    set((state) => ({ trashAccounts: state.trashAccounts.filter((account) => account.id !== id) }))
    const refreshFailed = await settleRefreshes('account restore', [get().loadAccounts(), get().loadAllAccounts(), get().loadTrashAccounts(), get().loadTotpAccounts()])
    return { refreshFailed }
  },

  hardDeleteAccount: async (id) => {
    const result = await window.electronAPI.hardDeleteAccount(id)
    if (!result.success) throw new Error('账号不存在或不在回收站中')
    set((state) => ({ trashAccounts: state.trashAccounts.filter((account) => account.id !== id) }))
    const refreshFailed = await settleRefreshes('account hard delete', [get().loadTrashAccounts(), get().loadAllAccounts(), get().loadTotpAccounts()])
    return { refreshFailed }
  },

  restoreSecretService: async (id) => {
    const result = await window.electronAPI.restoreSecretService(id)
    if (!result.success) throw new Error('服务不存在或已经恢复')
    set((state) => ({ trashServices: state.trashServices.filter((service) => service.id !== id) }))
    const refreshFailed = await settleRefreshes('service restore', [get().loadServiceInfo(), get().loadTrashServices()])
    return { refreshFailed }
  },

  hardDeleteSecretService: async (id) => {
    const result = await window.electronAPI.hardDeleteSecretService(id)
    if (!result.success) throw new Error('服务不存在或不在回收站中')
    set((state) => ({ trashServices: state.trashServices.filter((service) => service.id !== id) }))
    const refreshFailed = await settleRefreshes('service hard delete', [get().loadTrashServices()])
    return { refreshFailed }
  },

  addAccountTag: async (accountId, tagName) => {
    const result = await window.electronAPI.addAccountTag({ accountId, tagName })
    const refreshFailed = await settleRefreshes('account tag add', [get().loadAccounts(), get().loadAllAccounts()])
    return { ...result, refreshFailed }
  },

  removeAccountTag: async (accountId, tagId) => {
    const result = await window.electronAPI.removeAccountTag({ accountId, tagId })
    const refreshFailed = await settleRefreshes('account tag remove', [get().loadAccounts(), get().loadAllAccounts()])
    return { ...result, refreshFailed }
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
    let refreshFailed = false
    if (result.success) {
      refreshFailed = await settleRefreshes('database import', [
        get().loadTotpAccounts(),
        get().loadAccounts(),
        get().loadAllAccounts(),
        get().loadTrashAccounts(),
        get().loadServiceInfo(),
        get().loadTrashServices(),
      ])
      set((state) => ({ dataRevision: state.dataRevision + 1 }))
    }
    return { ...result, refreshFailed }
  },

  importCsvAccounts: async () => {
    const result = await window.electronAPI.importCsvAccounts()
    let refreshFailed = false
    if (result.count > 0) {
      refreshFailed = await settleRefreshes('CSV import', [get().loadAccounts(), get().loadAllAccounts(), get().loadTotpAccounts()])
    }
    return { ...result, refreshFailed }
  },
}))
