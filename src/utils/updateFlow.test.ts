import { describe, expect, it } from 'vitest'
import mainSource from '../../electron/main.ts?raw'
import cryptoSource from '../../electron/crypto.ts?raw'
import databaseSource from '../../electron/database.ts?raw'
import preloadSource from '../../electron/preload.ts?raw'
import indexHtmlSource from '../../index.html?raw'
import packageSource from '../../package.json?raw'
import appSource from '../App.tsx?raw'
import accountsViewSource from '../components/AccountsView.tsx?raw'
import settingsPanelSource from '../components/SettingsPanel.tsx?raw'
import sidebarSource from '../components/Sidebar.tsx?raw'
import titleBarSource from '../components/TitleBar.tsx?raw'
import typesSource from '../types.ts?raw'

describe('CredVaultix update flow wiring', () => {
  it('keeps the service information vault module wired while adding updates', () => {
    expect(appSource).toContain("lazy(() => import('./components/service-info/ServiceInfoManager'))")
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

  it('uses electron-updater to install the downloaded NSIS package after a database checkpoint', () => {
    expect(mainSource).toContain('let updateReadyToInstall = false')
    expect(mainSource).toContain('function checkpointDatabaseForUpdateInstall()')
    expect(mainSource).toContain('await autoUpdater.downloadUpdate()')
    expect(mainSource).toContain('updateReadyToInstall = true')
    expect(mainSource).toContain("database.pragma('wal_checkpoint(FULL)')")
    expect(mainSource).toContain('autoUpdater.quitAndInstall(true, true)')
    expect(mainSource).not.toContain("import { spawn } from 'child_process'")
    expect(mainSource).not.toContain('launchDownloadedInstallerAfterExit')
    expect(mainSource).not.toContain('quoteCmdArg')
    expect(mainSource).not.toContain('windowsHide: true')
  })

  it('resets updater install guards when an updater error occurs', () => {
    const errorHandlerStart = mainSource.indexOf("autoUpdater.on('error'")
    const errorHandlerEnd = mainSource.indexOf("autoUpdater.on('download-progress'", errorHandlerStart)
    const errorHandlerSource = mainSource.slice(errorHandlerStart, errorHandlerEnd)

    expect(errorHandlerStart).toBeGreaterThan(-1)
    expect(errorHandlerEnd).toBeGreaterThan(errorHandlerStart)
    expect(errorHandlerSource).toContain('isQuittingForUpdate = false')
    expect(errorHandlerSource).toContain('updateReadyToInstall = false')
    expect(errorHandlerSource).toContain("sendUpdateMessage('error'")
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

  it('adds a settings panel for manual update checks, installs, data actions, and appearance', () => {
    expect(sidebarSource).toContain('SettingsPanel')
    expect(sidebarSource).toContain('设置')
    expect(settingsPanelSource).toContain('SystemUpdateAltIcon')
    expect(settingsPanelSource).toContain('Dialog')
    expect(settingsPanelSource).toContain('版本与更新')
    expect(settingsPanelSource).toContain('检查更新')
    expect(settingsPanelSource).toContain('下载更新包')
    expect(settingsPanelSource).toContain('重启安装')
    expect(settingsPanelSource).toContain("| 'installing'")
    expect(settingsPanelSource).toContain('正在退出并安装更新...')
    expect(settingsPanelSource).toContain('handleQuitAndInstall')
    expect(settingsPanelSource).toContain("updateStatus === 'installing'")
    expect(settingsPanelSource).toContain("disabled={Boolean(navigationBlockReason) || updateStatus === 'installing'}")
    expect(settingsPanelSource).toContain('升级不会删除本地数据库')
    expect(settingsPanelSource).toContain('导入数据库')
    expect(settingsPanelSource).toContain('导出数据库')
    expect(settingsPanelSource).toContain('打开数据目录')
    expect(settingsPanelSource).toContain('切换到浅色模式')
    expect(settingsPanelSource).toContain('checkUpdates')
    expect(settingsPanelSource).toContain('downloadUpdate')
    expect(settingsPanelSource).toContain('quitAndInstall')
    expect(settingsPanelSource).toContain('onUpdateMessage')
    expect(titleBarSource).not.toContain('SystemUpdateAltIcon')
    expect(titleBarSource).not.toContain('FileUploadIcon')
    expect(titleBarSource).not.toContain('FileDownloadIcon')
    expect(titleBarSource).not.toContain('DarkModeIcon')
  })

  it('protects unsaved renderer edits when the desktop window closes', () => {
    expect(mainSource).toContain("ipcMain.on('app:setUnsavedChanges'")
    expect(mainSource).toContain("mainWindow.on('close'")
    expect(mainSource).toContain('dialog.showMessageBoxSync')
    expect(mainSource).toContain('放弃并退出')
    expect(preloadSource).toContain("ipcRenderer.send('app:setUnsavedChanges'")
    expect(typesSource).toContain('setUnsavedChanges')
  })

  it('uses user-created tag suggestions and full-row account field copying', () => {
    expect(accountsViewSource).toContain('function getCreatedTagSuggestions')
    expect(accountsViewSource).toContain("getAccounts({ isDeleted: false, platform: 'all' })")
    expect(accountsViewSource).toContain('已创建标签')
    expect(accountsViewSource).not.toContain('createdTagSuggestions.slice(0, 12)')
    expect(accountsViewSource).not.toContain('常用建议')
    expect(accountsViewSource).not.toContain('getSuggestedPlatformTags')
    expect(accountsViewSource).not.toContain('YouTube')
    expect(accountsViewSource).not.toContain('Figma')
    expect(accountsViewSource).toContain("const requiresRevealBeforeCopy = fieldKey === 'totp_secret'")
    expect(accountsViewSource).toContain('onClick={handleCopy}')
    expect(accountsViewSource).toContain('先显示')
    expect(accountsViewSource).toContain('已复制')
  })

  it('uses a single Vite-driven Electron dev launcher', () => {
    expect(packageSource).toContain('"electron:dev": "vite --host 127.0.0.1"')
    expect(packageSource).not.toContain('wait-on http://127.0.0.1:5173')
    expect(packageSource).not.toContain('&& electron .')
  })

  it('uses CredVaultix identity while migrating legacy AccountManager data into the new database name', () => {
    expect(mainSource).toContain("const APP_NAME = 'CredVaultix'")
    expect(mainSource).toContain('app.setName(APP_NAME)')
    expect(mainSource).toContain("const APP_ID = 'com.personal.credvaultix'")
    expect(mainSource).toContain('app.setAppUserModelId(APP_ID)')
    expect(mainSource).toContain('function getAppIconPath()')
    expect(mainSource).toContain("path.join(process.resourcesPath, 'assets', 'app.ico')")
    expect(mainSource).toContain('icon: getAppIconPath()')
    expect(mainSource).toContain('app.setPath(')
    expect(mainSource).toContain("argument.startsWith('--user-data-dir=')")
    expect(mainSource).toContain('app.requestSingleInstanceLock()')
    expect(mainSource).toContain("app.on('second-instance'")
    expect(mainSource.indexOf('\nconfigureAppIdentity()\n')).toBeLessThan(mainSource.indexOf('app.requestSingleInstanceLock()'))
    expect(mainSource).toContain('if (!usesExplicitUserDataDirectory)')
    expect(mainSource).toContain("path.join(app.getPath('appData'), APP_NAME)")
    expect(databaseSource).toContain("'credvaultix.db'")
    expect(mainSource).toContain("'account-manager.db'")
    expect(mainSource).toContain("'account-manager'")
    expect(mainSource).toContain("'AccountManager'")
    expect(mainSource).toContain("'prompt-manager'")
    expect(mainSource).toContain('copyFileSync')
    expect(mainSource).not.toContain("app.name = 'AccountManager'")
    expect(sidebarSource).toContain('CredVaultix')
    expect(sidebarSource).toContain("import appIcon from '../../assets/app.png'")
    expect(packageSource).toContain('"appId": "com.personal.credvaultix"')
    expect(packageSource).toContain('"icon": "assets/app.ico"')
    expect(packageSource).toContain('"installerIcon": "assets/app.ico"')
    expect(packageSource).toContain('"uninstallerIcon": "assets/app.ico"')
    expect(packageSource).toContain('"installerHeaderIcon": "assets/app.ico"')
    expect(packageSource).toContain('"from": "assets"')
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
