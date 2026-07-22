import path from 'path'
import { describe, expect, it, vi } from 'vitest'
import {
  type UpdaterCheckResult,
  type UpdaterControllerDependencies,
  type UpdaterPort,
  UpdaterController,
  detectDistributionMode,
} from './updaterController'

const executablePath = path.join('C:', 'Apps', 'CredVaultix', 'CredVaultix.exe')
const installDirectory = path.dirname(executablePath)
const uninstallerPath = path.join(installDirectory, 'Uninstall CredVaultix.exe')
const installerPath = path.join('C:', 'Temp', 'CredVaultix-Setup-1.2.0.exe')

interface HarnessOptions {
  updater?: UpdaterPort
  existingFiles?: Set<string>
  prepareForInstall?: UpdaterControllerDependencies['prepareForInstall']
  persistAttempt?: UpdaterControllerDependencies['persistAttempt']
  requestInstall?: UpdaterControllerDependencies['requestInstall']
  initialError?: string
}

function available(version = '1.2.0'): UpdaterCheckResult {
  return { isUpdateAvailable: true, updateInfo: { version } }
}

function createHarness(options: HarnessOptions = {}) {
  const existingFiles = options.existingFiles || new Set([uninstallerPath, installerPath])
  const updater = options.updater || {
    checkForUpdates: vi.fn(async () => available()),
    downloadUpdate: vi.fn(async () => [installerPath]),
  }
  const states: ReturnType<UpdaterController['getSnapshot']>[] = []
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
  const dependencies: UpdaterControllerDependencies = {
    updater,
    currentVersion: '1.1.1',
    releaseUrl: 'https://github.com/zzf-857/CredVaultix/releases/latest',
    logger,
    prepareForInstall: options.prepareForInstall || vi.fn(),
    persistAttempt: options.persistAttempt || vi.fn(),
    requestInstall: options.requestInstall || vi.fn(),
    fileExists: (candidate) => existingFiles.has(candidate),
    onState: (snapshot) => states.push(snapshot),
    isPackaged: true,
    executablePath,
    initialError: options.initialError,
  }

  return {
    controller: new UpdaterController(dependencies),
    dependencies,
    existingFiles,
    logger,
    states,
    updater,
  }
}

async function downloadReadyUpdate(controller: UpdaterController) {
  expect((await controller.checkForUpdates()).success).toBe(true)
  expect((await controller.downloadUpdate()).success).toBe(true)
}

describe('detectDistributionMode', () => {
  const base = {
    isPackaged: true,
    executablePath,
    fileExists: (candidate: string) => candidate === uninstallerPath,
  }

  it('distinguishes development, portable, installed, and unmanaged builds', () => {
    expect(detectDistributionMode({ ...base, isPackaged: false })).toBe('development')
    expect(detectDistributionMode({ ...base, portableExecutableFile: 'CredVaultix-Portable.exe' })).toBe('portable')
    expect(detectDistributionMode(base)).toBe('installed')
    expect(detectDistributionMode({ ...base, fileExists: () => false })).toBe('unmanaged')
  })

  it('checks for the product-specific uninstaller beside the executable', () => {
    const fileExists = vi.fn(() => true)
    detectDistributionMode({ ...base, productName: 'Custom Vault', fileExists })
    expect(fileExists).toHaveBeenCalledWith(path.join(installDirectory, 'Uninstall Custom Vault.exe'))
  })
})

describe('UpdaterController', () => {
  it('publishes a serializable initial snapshot', () => {
    const { controller, states } = createHarness()

    expect(controller.getSnapshot()).toEqual({
      revision: 0,
      currentVersion: '1.1.1',
      distribution: 'installed',
      status: 'idle',
      availableVersion: null,
      downloadedVersion: null,
      percent: 0,
      error: null,
      canInstall: false,
      releaseUrl: 'https://github.com/zzf-857/CredVaultix/releases/latest',
    })
    expect(states).toEqual([controller.getSnapshot()])
  })

  it('surfaces a reconciled startup error in the initial installed snapshot', () => {
    const { controller } = createHarness({ initialError: '上次更新启动后未完成' })

    expect(controller.getSnapshot()).toMatchObject({
      distribution: 'installed',
      status: 'error',
      error: '上次更新启动后未完成',
      canInstall: false,
    })
  })

  it('requires a returned, existing .exe before marking a download ready', async () => {
    const { controller, states } = createHarness()

    await controller.checkForUpdates()
    controller.reportDownloadProgress(42.4)
    const downloadPromise = controller.downloadUpdate()
    controller.reportDownloadProgress(42.4)
    const result = await downloadPromise

    expect(result.success).toBe(true)
    expect(result.snapshot).toMatchObject({
      status: 'downloaded',
      availableVersion: '1.2.0',
      downloadedVersion: '1.2.0',
      percent: 100,
      canInstall: true,
      error: null,
    })
    expect(states.some((state) => state.status === 'downloading' && state.percent === 42)).toBe(true)
  })

  it('rejects a missing or non-executable download result', async () => {
    const updater: UpdaterPort = {
      checkForUpdates: vi.fn(async () => available()),
      downloadUpdate: vi.fn(async () => ['C:/Temp/latest.yml', 'C:/Temp/missing.exe']),
    }
    const { controller } = createHarness({
      updater,
      existingFiles: new Set([uninstallerPath]),
    })

    await controller.checkForUpdates()
    const result = await controller.downloadUpdate()

    expect(result.success).toBe(false)
    expect(result.snapshot).toMatchObject({ status: 'error', downloadedVersion: null, canInstall: false })
    expect(result.error).toContain('未返回有效的 Windows 安装程序')
  })

  it('keeps a verified same-version download across repeated checks', async () => {
    const { controller, updater } = createHarness()
    await downloadReadyUpdate(controller)

    const result = await controller.checkForUpdates()

    expect(result.success).toBe(true)
    expect(result.snapshot).toMatchObject({
      status: 'downloaded',
      availableVersion: '1.2.0',
      downloadedVersion: '1.2.0',
      canInstall: true,
    })
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1)
  })

  it('keeps a verified download installable when a later check fails', async () => {
    const checkForUpdates = vi
      .fn<UpdaterPort['checkForUpdates']>()
      .mockResolvedValueOnce(available())
      .mockRejectedValueOnce(new Error('offline'))
    const { controller } = createHarness({
      updater: {
        checkForUpdates,
        downloadUpdate: vi.fn(async () => [installerPath]),
      },
    })
    await downloadReadyUpdate(controller)

    const result = await controller.checkForUpdates()

    expect(result.success).toBe(false)
    expect(result.snapshot).toMatchObject({
      status: 'downloaded',
      downloadedVersion: '1.2.0',
      canInstall: true,
    })
    expect(result.snapshot.error).toContain('offline')
  })

  it('keeps a verified download installable when the updater emits an asynchronous error', async () => {
    const { controller } = createHarness()
    await downloadReadyUpdate(controller)

    const result = controller.reportUpdaterError(new Error('installer process rejected'))

    expect(result.success).toBe(false)
    expect(result.snapshot).toMatchObject({
      status: 'downloaded',
      downloadedVersion: '1.2.0',
      canInstall: true,
    })
    expect(result.snapshot.error).toContain('installer process rejected')
  })

  it('does not allow check, download, and install operations to overlap', async () => {
    let resolveCheck!: (result: UpdaterCheckResult) => void
    const checkForUpdates = vi.fn(() => new Promise<UpdaterCheckResult>((resolve) => {
      resolveCheck = resolve
    }))
    const downloadUpdate = vi.fn(async () => [installerPath])
    const { controller } = createHarness({ updater: { checkForUpdates, downloadUpdate } })

    const checking = controller.checkForUpdates()
    const downloadWhileChecking = await controller.downloadUpdate()
    const secondCheck = await controller.checkForUpdates()

    expect(downloadWhileChecking.success).toBe(false)
    expect(secondCheck.success).toBe(false)
    expect(downloadWhileChecking.snapshot.status).toBe('checking')
    expect(downloadUpdate).not.toHaveBeenCalled()
    expect(checkForUpdates).toHaveBeenCalledTimes(1)

    resolveCheck(available())
    expect((await checking).success).toBe(true)
  })

  it('prepares and persists before requesting the standard updater install', async () => {
    const calls: string[] = []
    let persistedAttempt: Parameters<UpdaterControllerDependencies['persistAttempt']>[0] | null = null
    const { controller } = createHarness({
      prepareForInstall: async () => { calls.push('prepare') },
      persistAttempt: async (attempt) => {
        calls.push('persist')
        persistedAttempt = attempt
      },
      requestInstall: async () => { calls.push('request') },
    })
    await downloadReadyUpdate(controller)

    const result = await controller.installUpdate()

    expect(result.success).toBe(true)
    expect(result.snapshot.status).toBe('installing')
    expect(calls).toEqual(['prepare', 'persist', 'request'])
    expect(persistedAttempt).toMatchObject({
      sourceVersion: '1.1.1',
      targetVersion: '1.2.0',
      status: 'launching',
      installerPath,
    })
  })

  it('restores downloaded state when the standard updater request fails', async () => {
    const attempts: Parameters<UpdaterControllerDependencies['persistAttempt']>[0][] = []
    const { controller } = createHarness({
      persistAttempt: vi.fn(async (attempt) => { attempts.push(attempt) }),
      requestInstall: vi.fn(async () => { throw new Error('spawn denied') }),
    })
    await downloadReadyUpdate(controller)

    const result = await controller.installUpdate()

    expect(result.success).toBe(false)
    expect(result.snapshot).toMatchObject({
      status: 'downloaded',
      downloadedVersion: '1.2.0',
      canInstall: true,
    })
    expect(result.snapshot.error).toContain('spawn denied')
    expect(attempts.map((attempt) => attempt.status)).toEqual(['launching', 'failed'])
    expect(attempts[1]).toMatchObject({
      targetVersion: '1.2.0',
      status: 'failed',
      error: expect.stringContaining('spawn denied'),
    })
  })

  it('does not request installation when preparation or attempt persistence fails', async () => {
    const requestInstall = vi.fn()
    const { controller } = createHarness({
      prepareForInstall: vi.fn(async () => { throw new Error('checkpoint failed') }),
      requestInstall,
    })
    await downloadReadyUpdate(controller)

    const result = await controller.installUpdate()

    expect(result.success).toBe(false)
    expect(result.snapshot.status).toBe('downloaded')
    expect(requestInstall).not.toHaveBeenCalled()
  })

  it('does not retry a failed initial attempt write or request installation', async () => {
    const persistAttempt = vi.fn(async () => { throw new Error('state disk full') })
    const requestInstall = vi.fn()
    const { controller } = createHarness({ persistAttempt, requestInstall })
    await downloadReadyUpdate(controller)

    const result = await controller.installUpdate()

    expect(result.success).toBe(false)
    expect(result.error).toContain('state disk full')
    expect(persistAttempt).toHaveBeenCalledTimes(1)
    expect(requestInstall).not.toHaveBeenCalled()
  })

  it('does not replace the installer launch error when recording its failed state also fails', async () => {
    let persistCount = 0
    const persistAttempt = vi.fn(async () => {
      persistCount += 1
      if (persistCount === 2) throw new Error('failed-state disk full')
    })
    const { controller, logger } = createHarness({
      persistAttempt,
      requestInstall: vi.fn(async () => { throw new Error('spawn denied') }),
    })
    await downloadReadyUpdate(controller)

    const result = await controller.installUpdate()

    expect(result.success).toBe(false)
    expect(result.error).toContain('spawn denied')
    expect(result.error).not.toContain('failed-state disk full')
    expect(result.snapshot.error).toContain('spawn denied')
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('failed-state disk full'))
  })

  it('blocks automatic update actions outside an installed distribution', async () => {
    const updater = {
      checkForUpdates: vi.fn(async () => available()),
      downloadUpdate: vi.fn(async () => [installerPath]),
    }
    const states: ReturnType<UpdaterController['getSnapshot']>[] = []
    const controller = new UpdaterController({
      updater,
      currentVersion: '1.1.1',
      releaseUrl: 'https://example.test/releases',
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      prepareForInstall: vi.fn(),
      persistAttempt: vi.fn(),
      requestInstall: vi.fn(),
      fileExists: () => false,
      onState: (state) => states.push(state),
      isPackaged: true,
      executablePath,
    })

    const result = await controller.checkForUpdates()

    expect(controller.getSnapshot()).toMatchObject({ distribution: 'unmanaged', status: 'unsupported' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('不在安装器管理目录')
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
  })
})
