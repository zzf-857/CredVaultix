export const ACCOUNT_PLATFORMS = ['google', 'microsoft', 'github', 'qq', 'apple', 'other'] as const

export type AccountPlatform = typeof ACCOUNT_PLATFORMS[number]

export const ACCOUNT_PLATFORM_OPTIONS = [
  {
    platform: 'google',
    label: 'Google',
    description: '适合记录 Gmail、Google 登录、Google Cloud 和用 Google 登录的平台。',
  },
  {
    platform: 'microsoft',
    label: 'Microsoft',
    description: '适合记录 Outlook、Microsoft 登录、Azure 和相关平台访问。',
  },
  {
    platform: 'github',
    label: 'GitHub',
    description: '适合记录 GitHub 登录、代码仓库和用 GitHub 登录的平台。',
  },
  {
    platform: 'qq',
    label: 'QQ',
    description: '适合记录 QQ、QQ 邮箱和用 QQ 登录的平台。',
  },
  {
    platform: 'apple',
    label: 'Apple',
    description: '适合记录 Apple 账户、iCloud、App Store 和通过 Apple 登录的平台。',
  },
] as const

export function normalizeAccountPlatform(value?: string | null): AccountPlatform {
  return ACCOUNT_PLATFORMS.find((platform) => platform === value) ?? 'other'
}

export function getAccountPlatformLabel(platform: AccountPlatform): string {
  return ACCOUNT_PLATFORM_OPTIONS.find((option) => option.platform === platform)?.label ?? '其他'
}

export function getAccountPlatformDefaultName(platform: AccountPlatform): string {
  return platform === 'other' ? '新账号' : `${getAccountPlatformLabel(platform)} 账号`
}
