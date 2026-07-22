export type DistributionMode = 'development' | 'portable' | 'installed' | 'unmanaged'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'latest'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'
  | 'unsupported'

export interface UpdateSnapshot {
  revision: number
  currentVersion: string
  distribution: DistributionMode
  status: UpdateStatus
  availableVersion: string | null
  downloadedVersion: string | null
  percent: number
  error: string | null
  canInstall: boolean
  releaseUrl: string
}

export interface UpdateActionResult {
  success: boolean
  snapshot: UpdateSnapshot
  error?: string
}
