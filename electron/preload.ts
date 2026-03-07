import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Prompts
  getPrompts: (filters?: any) => ipcRenderer.invoke('prompts:getAll', filters),
  getPromptById: (id: string) => ipcRenderer.invoke('prompts:getById', id),
  createPrompt: (data: any) => ipcRenderer.invoke('prompts:create', data),
  updatePrompt: (id: string, data: any) => ipcRenderer.invoke('prompts:update', id, data),
  deletePrompt: (id: string) => ipcRenderer.invoke('prompts:delete', id),

  // Folders
  getFolders: () => ipcRenderer.invoke('folders:getAll'),
  createFolder: (data: any) => ipcRenderer.invoke('folders:create', data),
  updateFolder: (id: string, data: any) => ipcRenderer.invoke('folders:update', id, data),
  deleteFolder: (id: string) => ipcRenderer.invoke('folders:delete', id),

  // Tags
  getTags: () => ipcRenderer.invoke('tags:getAll'),
  createTag: (data: any) => ipcRenderer.invoke('tags:create', data),
  updateTag: (id: string, data: any) => ipcRenderer.invoke('tags:update', id, data),
  deleteTag: (id: string) => ipcRenderer.invoke('tags:delete', id),

  // TOTP 2FA
  getTotpAccounts: () => ipcRenderer.invoke('totp:getAll'),
  createTotpAccount: (data: any) => ipcRenderer.invoke('totp:create', data),
  updateTotpAccount: (id: string, data: any) => ipcRenderer.invoke('totp:update', id, data),
  deleteTotpAccount: (id: string) => ipcRenderer.invoke('totp:delete', id),
  incrementTotpCounter: (id: string) => ipcRenderer.invoke('totp:incrementCounter', id),

  // Accounts
  getAccounts: (filters?: any) => ipcRenderer.invoke('accounts:getAll', filters),
  getAccountById: (id: string) => ipcRenderer.invoke('accounts:getById', id),
  createAccount: (data: any) => ipcRenderer.invoke('accounts:create', data),
  updateAccount: (id: string, data: any) => ipcRenderer.invoke('accounts:update', id, data),
  deleteAccount: (id: string) => ipcRenderer.invoke('accounts:delete', id),

  // Custom Fields
  addAccountField: (data: any) => ipcRenderer.invoke('accounts:addField', data),
  updateAccountField: (id: string, data: any) => ipcRenderer.invoke('accounts:updateField', id, data),
  deleteAccountField: (id: string) => ipcRenderer.invoke('accounts:deleteField', id),

  // Database
  exportDatabase: () => ipcRenderer.invoke('db:export'),
  importDatabase: () => ipcRenderer.invoke('db:import'),
})
