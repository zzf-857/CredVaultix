import { describe, expect, it } from 'vitest'
import { getPlatformIconKey, PLATFORM_ICON_ASSETS } from './platformIcons'

describe('account platform icon catalog', () => {
  it.each([
    [' Google ', 'google'],
    ['GMAIL', 'google'],
    [' Microsoft ', 'microsoft'],
    ['Outlook', 'microsoft'],
    ['GitHub', 'github'],
    ['QQ', 'qq'],
    ['Apple', 'apple'],
    ['iCloud', 'apple'],
    ['Discord', 'discord'],
    ['Notion', 'notion'],
    ['OpenAI', 'openai'],
    ['ChatGPT', 'openai'],
    ['YouTube', 'youtube'],
    ['QQ账号', 'qq'],
    ['Apple 账号', 'apple'],
  ])('resolves exact alias %s to %s', (name, key) => {
    expect(getPlatformIconKey(name)).toBe(key)
  })

  it.each(['GitHub 企业内网', 'applepie', 'QQ团队', 'Custom Microsoft', 'toString', '__proto__', '', ' '])('does not mistake custom tag %s for a platform', (name) => {
    expect(getPlatformIconKey(name)).toBeNull()
  })

  it('uses bundled brand assets and preserves full color for Google and Microsoft', () => {
    expect(PLATFORM_ICON_ASSETS.google?.monochrome).toBe(false)
    expect(PLATFORM_ICON_ASSETS.microsoft?.monochrome).toBe(false)
    for (const asset of Object.values(PLATFORM_ICON_ASSETS)) {
      expect(asset.icon).toBeTruthy()
      expect(asset.icon).not.toMatch(/^https?:\/\//)
    }
    expect(PLATFORM_ICON_ASSETS.github?.monochrome).toBe(true)
    expect(PLATFORM_ICON_ASSETS.apple?.monochrome).toBe(true)
    expect(PLATFORM_ICON_ASSETS.qq?.monochrome).toBe(true)
  })
})
