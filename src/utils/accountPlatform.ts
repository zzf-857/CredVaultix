export type AccountPlatform = 'google' | 'microsoft' | 'other'

export function normalizeAccountPlatform(value?: string | null): AccountPlatform {
  if (value === 'google' || value === 'microsoft' || value === 'other') {
    return value
  }

  return 'other'
}

export function getAccountPlatformLabel(platform: AccountPlatform): string {
  switch (platform) {
    case 'google':
      return 'Google'
    case 'microsoft':
      return 'Microsoft'
    default:
      return '其他'
  }
}
