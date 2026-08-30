export type RuntimeDataProfileKind = 'explicit' | 'development' | 'tooling' | 'production'

export interface RuntimeDataInfo {
  version: string
  profile: RuntimeDataProfileKind
  dataDirectory: string
  databasePath: string
  counts: {
    accounts: number
    totpAccounts: number
    services: number
  }
}

export const RUNTIME_DATA_PROFILE_LABELS: Record<RuntimeDataProfileKind, string> = {
  production: '正式数据',
  development: '开发数据',
  tooling: 'Codex 隔离数据',
  explicit: '自定义数据',
}
