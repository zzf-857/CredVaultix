import { create } from 'zustand'
import { PromptRow, FolderRow, TagRow, TotpAccountRow, AccountRow, PromptFilters } from '../types'
import { v4 as uuidv4 } from 'uuid'

interface AppState {
  // Data
  prompts: PromptRow[]
  folders: FolderRow[]
  tags: TagRow[]
  totpAccounts: TotpAccountRow[]
  accounts: AccountRow[]

  // UI State
  activeView: 'accounts' | 'prompts' | '2fa'
  selectedPromptId: string | null
  selectedAccountId: string | null
  selectedFolderId: string | null
  selectedTagId: string | null
  favoritesOnly: boolean
  searchQuery: string
  accountSearchQuery: string
  isEditing: boolean
  themeMode: 'dark' | 'light'
  sidebarWidth: number

  // Actions
  setActiveView: (view: 'accounts' | 'prompts' | '2fa') => void
  loadData: () => Promise<void>
  loadTotpAccounts: () => Promise<void>
  loadAccounts: () => Promise<void>
  setSelectedPrompt: (id: string | null) => void
  setSelectedAccount: (id: string | null) => void
  setSelectedFolder: (id: string | null) => void
  setSelectedTag: (id: string | null) => void
  setFavoritesOnly: (v: boolean) => void
  setSearchQuery: (q: string) => void
  setAccountSearchQuery: (q: string) => void
  setIsEditing: (v: boolean) => void
  toggleTheme: () => void

  createPrompt: (title: string, content: string) => Promise<string>
  updatePrompt: (id: string, data: { title?: string; content?: string; folderId?: string | null; tags?: string[]; isFavorite?: number }) => Promise<void>
  deletePrompt: (id: string) => Promise<void>

  createFolder: (name: string, parentId?: string) => Promise<string>
  updateFolder: (id: string, data: { name?: string }) => Promise<void>
  deleteFolder: (id: string) => Promise<void>

  createTag: (name: string, color: string) => Promise<string>
  updateTag: (id: string, data: { name?: string; color?: string }) => Promise<void>
  deleteTag: (id: string) => Promise<void>

  createTotpAccount: (issuer: string, label: string, secret: string, otpType?: string, linkedAccountId?: string) => Promise<string>
  deleteTotpAccount: (id: string) => Promise<void>
  incrementTotpCounter: (id: string) => Promise<number>

  createAccount: (name: string) => Promise<string>
  updateAccount: (id: string, data: any) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  navigateToAccount: (accountId: string) => void

  exportDatabase: () => Promise<void>
  importDatabase: () => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  prompts: [],
  folders: [],
  tags: [],
  totpAccounts: [],
  accounts: [],
  activeView: 'accounts',
  selectedPromptId: null,
  selectedAccountId: null,
  selectedFolderId: null,
  selectedTagId: null,
  favoritesOnly: false,
  searchQuery: '',
  accountSearchQuery: '',
  isEditing: false,
  themeMode: 'dark',
  sidebarWidth: 260,

  setActiveView: (view) => set({ activeView: view }),

  loadData: async () => {
    const state = get()
    const filters: PromptFilters = {}
    if (state.selectedFolderId) filters.folderId = state.selectedFolderId
    if (state.selectedTagId) filters.tagId = state.selectedTagId
    if (state.searchQuery) filters.search = state.searchQuery
    if (state.favoritesOnly) filters.favoritesOnly = true

    const [prompts, folders, tags] = await Promise.all([
      window.electronAPI.getPrompts(filters),
      window.electronAPI.getFolders(),
      window.electronAPI.getTags(),
    ])
    set({ prompts, folders, tags })
  },

  loadTotpAccounts: async () => {
    const totpAccounts = await window.electronAPI.getTotpAccounts()
    set({ totpAccounts })
  },

  loadAccounts: async () => {
    const state = get()
    const accounts = await window.electronAPI.getAccounts({
      search: state.accountSearchQuery || undefined,
    })
    set({ accounts })
  },

  setSelectedPrompt: (id) => set({ selectedPromptId: id, isEditing: false }),
  setSelectedAccount: (id) => set({ selectedAccountId: id, isEditing: false }),
  setSelectedFolder: (id) => set({ selectedFolderId: id, selectedTagId: null, favoritesOnly: false }),
  setSelectedTag: (id) => set({ selectedTagId: id, selectedFolderId: null, favoritesOnly: false }),
  setFavoritesOnly: (v) => set({ favoritesOnly: v, selectedFolderId: null, selectedTagId: null }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setAccountSearchQuery: (q) => set({ accountSearchQuery: q }),
  setIsEditing: (v) => set({ isEditing: v }),
  toggleTheme: () => set((s) => ({ themeMode: s.themeMode === 'dark' ? 'light' : 'dark' })),

  createPrompt: async (title, content) => {
    const id = uuidv4()
    const state = get()
    await window.electronAPI.createPrompt({
      id, title, content,
      folderId: state.selectedFolderId || undefined,
    })
    await get().loadData()
    set({ selectedPromptId: id })
    return id
  },

  updatePrompt: async (id, data) => {
    await window.electronAPI.updatePrompt(id, data)
    await get().loadData()
  },

  deletePrompt: async (id) => {
    await window.electronAPI.deletePrompt(id)
    if (get().selectedPromptId === id) set({ selectedPromptId: null })
    await get().loadData()
  },

  createFolder: async (name, parentId) => {
    const id = uuidv4()
    await window.electronAPI.createFolder({ id, name, parentId })
    await get().loadData()
    return id
  },

  updateFolder: async (id, data) => {
    await window.electronAPI.updateFolder(id, data)
    await get().loadData()
  },

  deleteFolder: async (id) => {
    await window.electronAPI.deleteFolder(id)
    if (get().selectedFolderId === id) set({ selectedFolderId: null })
    await get().loadData()
  },

  createTag: async (name, color) => {
    const id = uuidv4()
    await window.electronAPI.createTag({ id, name, color })
    await get().loadData()
    return id
  },

  updateTag: async (id, data) => {
    await window.electronAPI.updateTag(id, data)
    await get().loadData()
  },

  deleteTag: async (id) => {
    await window.electronAPI.deleteTag(id)
    if (get().selectedTagId === id) set({ selectedTagId: null })
    await get().loadData()
  },

  createTotpAccount: async (issuer, label, secret, otpType, linkedAccountId) => {
    const id = uuidv4()
    await window.electronAPI.createTotpAccount({ id, issuer, label, secret, otpType: otpType || 'totp', linkedAccountId })
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

  createAccount: async (name) => {
    const id = uuidv4()
    await window.electronAPI.createAccount({ id, name })
    await get().loadAccounts()
    set({ selectedAccountId: id, isEditing: true })
    return id
  },

  updateAccount: async (id, data) => {
    await window.electronAPI.updateAccount(id, data)
    await get().loadAccounts()
  },

  deleteAccount: async (id) => {
    await window.electronAPI.deleteAccount(id)
    if (get().selectedAccountId === id) set({ selectedAccountId: null })
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
      await get().loadData()
      await get().loadTotpAccounts()
      await get().loadAccounts()
    }
  },
}))
