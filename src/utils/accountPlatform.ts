export type AccountPlatform = 'google' | 'microsoft' | 'other'

const SUGGESTED_TAGS: Record<AccountPlatform, string[]> = {
  google: ['YouTube', 'Google Cloud', 'GitHub', 'Notion', 'Discord', 'Figma', 'Slack'],
  microsoft: ['Azure', 'GitHub', 'OpenAI', 'Notion', 'Discord', 'Slack'],
  other: ['GitHub', 'Notion', 'Discord', 'Slack'],
}

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

export function getSuggestedPlatformTags(
  platform: AccountPlatform,
  existingTags: string[] = []
): string[] {
  const existing = new Set(existingTags.map((tag) => tag.trim()).filter(Boolean))

  return SUGGESTED_TAGS[platform].filter((tag) => !existing.has(tag))
}
