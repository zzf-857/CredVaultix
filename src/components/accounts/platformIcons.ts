import googleIcon from '@lobehub/icons-static-svg/icons/google-color.svg'
import microsoftIcon from '@lobehub/icons-static-svg/icons/microsoft-color.svg'
import githubIcon from '@lobehub/icons-static-svg/icons/github.svg'
import appleIcon from '@lobehub/icons-static-svg/icons/apple.svg'
import notionIcon from '@lobehub/icons-static-svg/icons/notion.svg'
import openAiIcon from '@lobehub/icons-static-svg/icons/openai.svg'
import qqIcon from '../../assets/platform-icons/qq.svg'
import discordIcon from '../../assets/platform-icons/discord.svg'

export type PlatformIconKey =
  | 'google'
  | 'microsoft'
  | 'github'
  | 'qq'
  | 'apple'
  | 'discord'
  | 'notion'
  | 'openai'
  | 'youtube'

export interface PlatformIconAsset {
  icon: string
  monochrome: boolean
}

export const PLATFORM_ICON_ASSETS: Partial<Record<PlatformIconKey, PlatformIconAsset>> = {
  google: { icon: googleIcon, monochrome: false },
  microsoft: { icon: microsoftIcon, monochrome: false },
  github: { icon: githubIcon, monochrome: true },
  qq: { icon: qqIcon, monochrome: true },
  apple: { icon: appleIcon, monochrome: true },
  discord: { icon: discordIcon, monochrome: true },
  notion: { icon: notionIcon, monochrome: true },
  openai: { icon: openAiIcon, monochrome: true },
}

const PLATFORM_ICON_ALIASES: Record<string, PlatformIconKey> = {
  google: 'google',
  gmail: 'google',
  谷歌: 'google',
  谷歌账号: 'google',
  'google账号': 'google',
  'google 账号': 'google',
  'google 主账号': 'google',
  microsoft: 'microsoft',
  outlook: 'microsoft',
  hotmail: 'microsoft',
  微软: 'microsoft',
  微软账号: 'microsoft',
  'microsoft账号': 'microsoft',
  'microsoft 账号': 'microsoft',
  'microsoft 主账号': 'microsoft',
  github: 'github',
  'github账号': 'github',
  'github 账号': 'github',
  'github 主账号': 'github',
  qq: 'qq',
  'qq账号': 'qq',
  'qq 账号': 'qq',
  'qq 主账号': 'qq',
  apple: 'apple',
  icloud: 'apple',
  'apple id': 'apple',
  苹果: 'apple',
  苹果账号: 'apple',
  'apple账号': 'apple',
  'apple 账号': 'apple',
  'apple 主账号': 'apple',
  discord: 'discord',
  notion: 'notion',
  openai: 'openai',
  chatgpt: 'openai',
  youtube: 'youtube',
}

export function getPlatformIconKey(name?: string | null): PlatformIconKey | null {
  if (!name) return null
  const normalized = name.trim().toLowerCase()
  return Object.prototype.hasOwnProperty.call(PLATFORM_ICON_ALIASES, normalized)
    ? PLATFORM_ICON_ALIASES[normalized]
    : null
}
