import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

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
  restoreAccount: (id: string) => ipcRenderer.invoke('accounts:restore', id),
  hardDeleteAccount: (id: string) => ipcRenderer.invoke('accounts:hardDelete', id),
  importCsvAccounts: () => ipcRenderer.invoke('accounts:importCsv'),
  addAccountTag: (data: any) => ipcRenderer.invoke('accounts:addTag', data),
  removeAccountTag: (data: any) => ipcRenderer.invoke('accounts:removeTag', data),

  // Custom Fields
  addAccountField: (data: any) => ipcRenderer.invoke('accounts:addField', data),
  updateAccountField: (id: string, data: any) => ipcRenderer.invoke('accounts:updateField', id, data),
  deleteAccountField: (id: string) => ipcRenderer.invoke('accounts:deleteField', id),

  // Database
  exportDatabase: () => ipcRenderer.invoke('db:export'),
  importDatabase: () => ipcRenderer.invoke('db:import'),
})
