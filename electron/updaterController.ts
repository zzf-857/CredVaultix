import path from 'path'
import type {
  DistributionMode,
  UpdateActionResult,
  UpdateSnapshot,
  UpdateStatus,
} from '../shared/update'

export interface UpdaterCheckResult {
  isUpdateAvailable: boolean
  updateInfo: {
    version: string
  }
}

export interface UpdaterPort {
  checkForUpdates: () => Promise<UpdaterCheckResult | null>
  downloadUpdate: () => Promise<string[]>
}

export interface UpdaterLogger {
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
}

export interface InstallAttempt {
  sourceVersion: string
  targetVersion: string
  status: 'launching' | 'failed'
  installerPath: string
  startedAt: string
  updatedAt: string
  error?: string
}

export interface DistributionDetectionOptions {
  isPackaged: boolean
  executablePath: string
  productName?: string
  portableExecutableDir?: string
  portableExecutableFile?: string
  fileExists: (filePath: string) => boolean
}

export interface UpdaterControllerDependencies extends DistributionDetectionOptions {
  updater: UpdaterPort
  currentVersion: string
  releaseUrl: string
  logger: UpdaterLogger
  prepareForInstall: () => void | Promise<void>
  persistAttempt: (attempt: InstallAttempt) => void | Promise<void>
  requestInstall: () => void | Promise<void>
  onState: (snapshot: UpdateSnapshot) => void
  initialError?: string
}

type ActiveAction = 'check' | 'download' | 'install'

const DEFAULT_PRODUCT_NAME = 'CredVaultix'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function clampPercent(percent: number) {
  if (!Number.isFinite(percent)) return 0
  return Math.max(0, Math.min(100, Math.round(percent)))
}

function cloneSnapshot(snapshot: UpdateSnapshot): UpdateSnapshot {
  return { ...snapshot }
}

export function detectDistributionMode(options: DistributionDetectionOptions): DistributionMode {
  if (!options.isPackaged) return 'development'
  if (options.portableExecutableDir || options.portableExecutableFile) return 'portable'

  const productName = options.productName || DEFAULT_PRODUCT_NAME
  const uninstallerPath = path.join(path.dirname(options.executablePath), `Uninstall ${productName}.exe`)
  return options.fileExists(uninstallerPath) ? 'installed' : 'unmanaged'
}

export class UpdaterController {
  private readonly dependencies: UpdaterControllerDependencies
  private readonly distribution: DistributionMode
  private state: UpdateSnapshot
  private activeAction: ActiveAction | null = null
  private installerPath: string | null = null

  constructor(dependencies: UpdaterControllerDependencies) {
    this.dependencies = dependencies
    this.distribution = detectDistributionMode(dependencies)
    this.state = {
      revision: 0,
      currentVersion: dependencies.currentVersion,
      distribution: this.distribution,
      status: this.distribution === 'installed'
        ? dependencies.initialError ? 'error' : 'idle'
        : 'unsupported',
      availableVersion: null,
      downloadedVersion: null,
      percent: 0,
      error: this.distribution === 'installed' ? dependencies.initialError || null : null,
      canInstall: false,
      releaseUrl: dependencies.releaseUrl,
    }
    dependencies.onState(this.getSnapshot())
  }

  getSnapshot(): UpdateSnapshot {
    return cloneSnapshot(this.state)
  }

  reportDownloadProgress(percent: number) {
    if (this.activeAction !== 'download' || this.state.status !== 'downloading') return
    this.transition({ percent: clampPercent(percent) })
  }

  reportUpdaterError(error: unknown): UpdateActionResult {
    return this.fail(error, '更新操作失败')
  }

  async checkForUpdates(): Promise<UpdateActionResult> {
    const unavailable = this.requireInstalledDistribution()
    if (unavailable) return unavailable
    const busy = this.requireIdleAction('check')
    if (busy) return busy

    this.activeAction = 'check'
    this.transition({ status: 'checking', error: null })

    try {
      const result = await this.dependencies.updater.checkForUpdates()
      if (!result) {
        throw new Error('更新服务未返回检查结果')
      }

      if (!result.isUpdateAvailable) {
        this.clearDownloadedInstaller()
        this.transition({
          status: 'latest',
          availableVersion: null,
          downloadedVersion: null,
          percent: 0,
          error: null,
        })
        return this.success()
      }

      const version = result.updateInfo?.version?.trim()
      if (!version) {
        throw new Error('更新服务未返回有效版本号')
      }

      if (version === this.state.downloadedVersion && this.hasValidInstaller()) {
        this.transition({
          status: 'downloaded',
          availableVersion: version,
          percent: 100,
          error: null,
        })
        return this.success()
      }

      this.clearDownloadedInstaller()
      this.transition({
        status: 'available',
        availableVersion: version,
        downloadedVersion: null,
        percent: 0,
        error: null,
      })
      return this.success()
    } catch (error) {
      return this.fail(error, '检查更新失败')
    } finally {
      this.activeAction = null
    }
  }

  async downloadUpdate(): Promise<UpdateActionResult> {
    const unavailable = this.requireInstalledDistribution()
    if (unavailable) return unavailable
    const busy = this.requireIdleAction('download')
    if (busy) return busy

    const version = this.state.availableVersion
    if (!version) {
      return this.failWithoutTransition('请先检查并确认有可用更新')
    }

    if (version === this.state.downloadedVersion && this.hasValidInstaller()) {
      this.transition({ status: 'downloaded', percent: 100, error: null })
      return this.success()
    }

    this.activeAction = 'download'
    this.transition({ status: 'downloading', percent: 0, error: null })

    try {
      const downloadedPaths = await this.dependencies.updater.downloadUpdate()
      const installerPath = downloadedPaths.find((candidate) =>
        path.extname(candidate).toLowerCase() === '.exe' && this.safeFileExists(candidate)
      )
      if (!installerPath) {
        throw new Error('更新下载未返回有效的 Windows 安装程序')
      }

      this.installerPath = installerPath
      this.transition({
        status: 'downloaded',
        downloadedVersion: version,
        percent: 100,
        error: null,
      })
      return this.success()
    } catch (error) {
      return this.fail(error, '下载更新失败')
    } finally {
      this.activeAction = null
    }
  }

  async installUpdate(): Promise<UpdateActionResult> {
    const unavailable = this.requireInstalledDistribution()
    if (unavailable) return unavailable
    const busy = this.requireIdleAction('install')
    if (busy) return busy

    if (!this.state.downloadedVersion || !this.hasValidInstaller() || !this.installerPath) {
      this.clearDownloadedInstaller()
      this.transition({
        status: 'error',
        downloadedVersion: null,
        error: '更新安装包不存在或已失效，请重新下载',
      })
      return this.failure(this.state.error || '更新安装包无效')
    }

    const installerPath = this.installerPath
    const version = this.state.downloadedVersion
    this.activeAction = 'install'
    this.transition({ status: 'installing', error: null })

    let persistedAttempt: InstallAttempt | null = null
    try {
      await this.dependencies.prepareForInstall()
      const attemptedAt = new Date().toISOString()
      const attempt: InstallAttempt = {
        sourceVersion: this.state.currentVersion,
        targetVersion: version,
        status: 'launching',
        installerPath,
        startedAt: attemptedAt,
        updatedAt: attemptedAt,
      }
      await this.dependencies.persistAttempt(attempt)
      persistedAttempt = attempt

      await this.dependencies.requestInstall()
      this.dependencies.logger.info(`Standard updater install requested for v${version}`)
      return this.success()
    } catch (error) {
      const message = this.formatFailure(error, '启动更新安装失败')
      if (persistedAttempt) {
        try {
          await this.dependencies.persistAttempt({
            ...persistedAttempt,
            status: 'failed',
            error: message,
            updatedAt: new Date().toISOString(),
          })
        } catch (persistError) {
          this.dependencies.logger.error(
            `Failed to persist update launch failure: ${errorMessage(persistError)}; original error: ${message}`
          )
        }
      }
      return this.failWithMessage(message)
    } finally {
      this.activeAction = null
    }
  }

  private requireInstalledDistribution(): UpdateActionResult | null {
    if (this.distribution === 'installed') return null

    const error = this.distribution === 'development'
      ? '开发环境不执行自动更新'
      : this.distribution === 'portable'
        ? '便携版不支持自动安装，请前往发布页下载更新'
        : '当前程序不在安装器管理目录中，请前往发布页手动更新'
    return this.failure(error)
  }

  private requireIdleAction(requestedAction: ActiveAction): UpdateActionResult | null {
    if (!this.activeAction) return null
    return this.failure(`更新操作 ${this.activeAction} 正在进行，无法开始 ${requestedAction}`)
  }

  private hasValidInstaller() {
    return Boolean(
      this.installerPath
      && path.extname(this.installerPath).toLowerCase() === '.exe'
      && this.safeFileExists(this.installerPath)
    )
  }

  private safeFileExists(filePath: string) {
    try {
      return this.dependencies.fileExists(filePath)
    } catch (error) {
      this.dependencies.logger.warn(`Failed to validate update file: ${errorMessage(error)}`)
      return false
    }
  }

  private clearDownloadedInstaller() {
    this.installerPath = null
  }

  private fail(error: unknown, context: string): UpdateActionResult {
    return this.failWithMessage(this.formatFailure(error, context))
  }

  private formatFailure(error: unknown, context: string) {
    const detail = errorMessage(error)
    return detail ? `${context}：${detail}` : context
  }

  private failWithMessage(message: string): UpdateActionResult {
    this.dependencies.logger.error(message)

    if (this.state.downloadedVersion && this.hasValidInstaller()) {
      this.transition({ status: 'downloaded', percent: 100, error: message })
    } else {
      this.clearDownloadedInstaller()
      this.transition({ status: 'error', downloadedVersion: null, error: message })
    }
    return this.failure(message)
  }

  private failWithoutTransition(error: string): UpdateActionResult {
    this.dependencies.logger.warn(error)
    return this.failure(error)
  }

  private success(): UpdateActionResult {
    return { success: true, snapshot: this.getSnapshot() }
  }

  private failure(error: string): UpdateActionResult {
    return { success: false, error, snapshot: this.getSnapshot() }
  }

  private transition(patch: Partial<Omit<UpdateSnapshot, 'revision' | 'currentVersion' | 'distribution' | 'releaseUrl' | 'canInstall'>>) {
    const status = (patch.status || this.state.status) as UpdateStatus
    const next = {
      ...this.state,
      ...patch,
      revision: this.state.revision + 1,
      status,
      canInstall: false,
    }
    next.canInstall = this.distribution === 'installed'
      && status === 'downloaded'
      && Boolean(next.downloadedVersion)
      && this.hasValidInstaller()
    this.state = next
    this.dependencies.onState(this.getSnapshot())
  }
}
