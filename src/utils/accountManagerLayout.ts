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

export function mergeVisibleAccountOrder(
  savedOrder: string[],
  allAccountIds: string[],
  visibleOrder: string[]
) {
  const visibleIds = new Set(visibleOrder)
  const completeOrder = Array.from(new Set([...savedOrder, ...allAccountIds]))
  let visibleIndex = 0

  return completeOrder.map((id) => {
    if (!visibleIds.has(id)) return id
    const replacement = visibleOrder[visibleIndex]
    visibleIndex += 1
    return replacement
  })
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
