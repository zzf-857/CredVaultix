import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_TAG_INPUT_CONTROL_HEIGHT,
  getAccountDetailSectionOrder,
  getVisibleAccountPreviewTags,
} from './accountManagerLayout'

describe('ACCOUNT_TAG_INPUT_CONTROL_HEIGHT', () => {
  it('uses a shared 40px control height for tag input row controls', () => {
    expect(ACCOUNT_TAG_INPUT_CONTROL_HEIGHT).toBe(40)
  })
})

describe('getVisibleAccountPreviewTags', () => {
  it('returns all tags instead of truncating after four items', () => {
    expect(
      getVisibleAccountPreviewTags(['GitHub', 'Notion', 'Discord', 'Figma', 'Slack'])
    ).toEqual(['GitHub', 'Notion', 'Discord', 'Figma', 'Slack'])
  })
})

describe('getAccountDetailSectionOrder', () => {
  it('promotes realtime code to the top when the account has a 2FA secret', () => {
    expect(getAccountDetailSectionOrder(true)).toEqual([
      'realtime-code',
      'account-info',
      'registered-platform-tags',
      'custom-fields',
      'notes',
    ])
  })

  it('keeps the rest of the sections in stable order when no 2FA secret exists', () => {
    expect(getAccountDetailSectionOrder(false)).toEqual([
      'account-info',
      'registered-platform-tags',
      'custom-fields',
      'notes',
    ])
  })
})
