export const ACCOUNT_TAG_INPUT_CONTROL_HEIGHT = 40

export type AccountDetailSection =
  | 'realtime-code'
  | 'account-info'
  | 'registered-platform-tags'
  | 'custom-fields'
  | 'notes'

export function getVisibleAccountPreviewTags<T>(tags: T[]): T[] {
  return tags
}

export function getAccountDetailSectionOrder(hasTotpSecret: boolean): AccountDetailSection[] {
  if (hasTotpSecret) {
    return [
      'realtime-code',
      'account-info',
      'registered-platform-tags',
      'custom-fields',
      'notes',
    ]
  }

  return ['account-info', 'registered-platform-tags', 'custom-fields', 'notes']
}
