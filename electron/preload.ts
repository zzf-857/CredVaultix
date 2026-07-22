import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  setUnsavedChanges: (hasUnsavedChanges: boolean) => ipcRenderer.send('app:setUnsavedChanges', hasUnsavedChanges),

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

  // Service Information
  getServiceInfo: () => ipcRenderer.invoke('serviceInfo:getAll'),
  getServiceDetail: (serviceId: string) => ipcRenderer.invoke('serviceInfo:getDetail', serviceId),
  createSecretGroup: (data: any) => ipcRenderer.invoke('serviceInfo:createGroup', data),
  updateSecretGroup: (id: string, data: any) => ipcRenderer.invoke('serviceInfo:updateGroup', id, data),
  deleteSecretGroup: (id: string) => ipcRenderer.invoke('serviceInfo:deleteGroup', id),
  createSecretService: (data: any) => ipcRenderer.invoke('serviceInfo:createService', data),
  updateSecretService: (id: string, data: any) => ipcRenderer.invoke('serviceInfo:updateService', id, data),
  deleteSecretService: (id: string) => ipcRenderer.invoke('serviceInfo:deleteService', id),
  getDeletedSecretServices: () => ipcRenderer.invoke('serviceInfo:getDeletedServices'),
  restoreSecretService: (id: string) => ipcRenderer.invoke('serviceInfo:restoreService', id),
  hardDeleteSecretService: (id: string) => ipcRenderer.invoke('serviceInfo:hardDeleteService', id),
  moveSecretServices: (data: any) => ipcRenderer.invoke('serviceInfo:moveServices', data),
  reorderSecretServices: (data: any) => ipcRenderer.invoke('serviceInfo:reorderServices', data),
  createSecretFieldGroup: (data: any) => ipcRenderer.invoke('serviceInfo:createFieldGroup', data),
  updateSecretFieldGroup: (id: string, data: any) => ipcRenderer.invoke('serviceInfo:updateFieldGroup', id, data),
  deleteSecretFieldGroup: (id: string) => ipcRenderer.invoke('serviceInfo:deleteFieldGroup', id),
  createSecretField: (data: any) => ipcRenderer.invoke('serviceInfo:createField', data),
  updateSecretField: (id: string, data: any) => ipcRenderer.invoke('serviceInfo:updateField', id, data),
  deleteSecretField: (id: string) => ipcRenderer.invoke('serviceInfo:deleteField', id),
  moveSecretFields: (data: any) => ipcRenderer.invoke('serviceInfo:moveFields', data),
  reorderSecretFields: (data: any) => ipcRenderer.invoke('serviceInfo:reorderFields', data),
  openDataDirectory: () => ipcRenderer.invoke('app:openDataDirectory'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),

  // Preferences
  getAppPreferences: () => ipcRenderer.invoke('preferences:get'),
  updateAppPreferences: (patch: any) => ipcRenderer.invoke('preferences:update', patch),
  resetAppPreferences: () => ipcRenderer.invoke('preferences:reset'),

  // Updates
  getUpdateState: () => ipcRenderer.invoke('update:get-state'),
  checkUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  openUpdateLog: () => ipcRenderer.invoke('update:open-log'),
  onUpdateMessage: (callback: (message: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: any) => callback(message)
    ipcRenderer.on('update:message', listener)
    return () => ipcRenderer.removeListener('update:message', listener)
  },

  // Database
  exportDatabase: () => ipcRenderer.invoke('db:export'),
  importDatabase: () => ipcRenderer.invoke('db:import'),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
