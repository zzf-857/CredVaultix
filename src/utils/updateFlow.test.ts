import { describe, expect, it } from 'vitest'
import mainSource from '../../electron/main.ts?raw'
import cryptoSource from '../../electron/crypto.ts?raw'
import databaseSource from '../../electron/database.ts?raw'
import preloadSource from '../../electron/preload.ts?raw'
import indexHtmlSource from '../../index.html?raw'
import appSource from '../App.tsx?raw'
import sidebarSource from '../components/Sidebar.tsx?raw'
import titleBarSource from '../components/TitleBar.tsx?raw'
import typesSource from '../types.ts?raw'

describe('CredVaultix update flow wiring', () => {
  it('keeps the service information vault module wired while adding updates', () => {
    expect(appSource).toContain("import ServiceInfoManager from './components/service-info/ServiceInfoManager'")
    expect(appSource).toContain("activeView === 'service-info'")
    expect(sidebarSource).toContain('服务信息')
    expect(databaseSource).toContain('secret_services')
    expect(databaseSource).toContain('secret_fields')
    expect(mainSource).toContain("import { registerServiceInfoIpc } from './serviceInfoRepository'")
    expect(mainSource).toContain('registerServiceInfoIpc(db)')
    expect(preloadSource).toContain('getServiceInfo')
    expect(typesSource).toContain('ServiceInfoPayload')
  })

  it('registers electron-updater with packaged and portable safeguards', () => {
    expect(mainSource).toContain("import { autoUpdater } from 'electron-updater'")
    expect(mainSource).toContain('function setupAutoUpdater()')
    expect(mainSource).toContain('autoUpdater.autoDownload = false')
    expect(mainSource).toContain('autoUpdater.autoInstallOnAppQuit = false')
    expect(mainSource).toContain('process.env.PORTABLE_EXECUTABLE_DIR')
    expect(mainSource).toContain('process.env.PORTABLE_EXECUTABLE_FILE')
    expect(mainSource).toContain('!app.isPackaged')
    expect(mainSource).toContain("mainWindow.webContents.send('update:message'")
    expect(mainSource).toContain("'checking-for-update'")
    expect(mainSource).toContain("'update-available'")
    expect(mainSource).toContain("'update-not-available'")
    expect(mainSource).toContain("'download-progress'")
    expect(mainSource).toContain("'update-downloaded'")
    expect(mainSource).toContain("ipcMain.handle('app:getVersion'")
    expect(mainSource).toContain("ipcMain.handle('update:check'")
    expect(mainSource).toContain("ipcMain.handle('update:download'")
    expect(mainSource).toContain("ipcMain.handle('update:quit-and-install'")
    expect(mainSource).toContain('setTimeout')
    expect(mainSource).toContain('5000')
  })

  it('exposes updater controls through preload and renderer types', () => {
    for (const methodName of [
      'getVersion',
      'checkUpdates',
      'downloadUpdate',
      'quitAndInstall',
      'onUpdateMessage',
    ]) {
      expect(preloadSource).toContain(methodName)
      expect(typesSource).toContain(methodName)
    }

    expect(preloadSource).toContain("ipcRenderer.invoke('app:getVersion')")
    expect(preloadSource).toContain("ipcRenderer.invoke('update:check')")
    expect(preloadSource).toContain("ipcRenderer.invoke('update:download')")
    expect(preloadSource).toContain("ipcRenderer.invoke('update:quit-and-install')")
    expect(preloadSource).toContain("ipcRenderer.on('update:message'")
    expect(preloadSource).toContain('removeListener')
    expect(typesSource).toContain('UpdateMessage')
  })

  it('adds a compact TitleBar dialog for manual update checks and installs', () => {
    expect(titleBarSource).toContain('SystemUpdateAltIcon')
    expect(titleBarSource).toContain('Dialog')
    expect(titleBarSource).toContain('版本与更新')
    expect(titleBarSource).toContain('当前版本')
    expect(titleBarSource).toContain('检查更新')
    expect(titleBarSource).toContain('下载更新包')
    expect(titleBarSource).toContain('重启安装')
    expect(titleBarSource).toContain('升级不会删除本地数据库')
    expect(titleBarSource).toContain('checkUpdates')
    expect(titleBarSource).toContain('downloadUpdate')
    expect(titleBarSource).toContain('quitAndInstall')
    expect(titleBarSource).toContain('onUpdateMessage')
  })

  it('uses CredVaultix identity while migrating legacy AccountManager data into the new database name', () => {
    expect(mainSource).toContain("const APP_NAME = 'CredVaultix'")
    expect(mainSource).toContain('app.setName(APP_NAME)')
    expect(mainSource).toContain("app.setPath('userData'")
    expect(mainSource).toContain("path.join(app.getPath('appData'), APP_NAME)")
    expect(databaseSource).toContain("'credvaultix.db'")
    expect(mainSource).toContain("'account-manager.db'")
    expect(mainSource).toContain("'account-manager'")
    expect(mainSource).toContain("'AccountManager'")
    expect(mainSource).toContain("'prompt-manager'")
    expect(mainSource).toContain('copyFileSync')
    expect(mainSource).not.toContain("app.name = 'AccountManager'")
    expect(titleBarSource).toContain('CredVaultix')
    expect(indexHtmlSource).toContain('<title>CredVaultix</title>')
    expect(indexHtmlSource).not.toContain('<title>AccountManager</title>')
  })

  it('keeps legacy encrypted account and service fields readable after the userData path rename', () => {
    expect(cryptoSource).toContain('CredVaultix')
    expect(cryptoSource).toContain('SecureVault')
    expect(cryptoSource).toContain("'account-manager'")
    expect(cryptoSource).toContain("'AccountManager'")
    expect(cryptoSource).toContain("'prompt-manager'")
    expect(cryptoSource).toContain('getCandidateKeys')
  })
})
