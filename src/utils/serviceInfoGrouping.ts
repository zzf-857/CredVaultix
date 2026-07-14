import type { ServiceInfoSortMode } from '../types'

export interface GroupableItem {
  id: string
  group_id: string | null
  name?: string
  field_name?: string
  sort_order: number
  updated_at?: string
  is_favorite?: number
}

export function getGroupedItems<T extends GroupableItem>(items: T[]) {
  const groups: Record<string, T[]> = {}
  const ungrouped: T[] = []

  for (const item of items) {
    if (item.group_id) {
      groups[item.group_id] = groups[item.group_id] || []
      groups[item.group_id].push(item)
    } else {
      ungrouped.push(item)
    }
  }

  return { ungrouped, groups }
}

export function moveItemsToGroup<T extends GroupableItem>(items: T[], ids: string[], groupId: string | null): T[] {
  const selected = new Set(ids)
  return items.map((item) => (selected.has(item.id) ? { ...item, group_id: groupId } : item))
}

export function reorderItems<T extends GroupableItem>(items: T[], orderedIds: string[]): T[] {
  const order = new Map(orderedIds.map((id, index) => [id, index + 1]))
  return items.map((item) => (order.has(item.id) ? { ...item, sort_order: order.get(item.id)! } : item))
}

export function moveIdsBefore(orderedIds: string[], movingIds: string[], targetId: string): string[] {
  const movingIdSet = new Set(movingIds)
  const uniqueMovingIds = orderedIds.filter((id) => movingIdSet.has(id))
  if (uniqueMovingIds.length === 0 || uniqueMovingIds.includes(targetId) || !orderedIds.includes(targetId)) {
    return [...orderedIds]
  }

  const remainingIds = orderedIds.filter((id) => !uniqueMovingIds.includes(id))
  const targetIndex = remainingIds.indexOf(targetId)
  return [
    ...remainingIds.slice(0, targetIndex),
    ...uniqueMovingIds,
    ...remainingIds.slice(targetIndex),
  ]
}

function labelOf(item: GroupableItem) {
  return item.name || item.field_name || ''
}

export function sortServiceInfoItems<T extends GroupableItem>(items: T[], mode: ServiceInfoSortMode): T[] {
  const sorted = [...items]

  switch (mode) {
    case 'name-asc':
      return sorted.sort((a, b) => labelOf(a).localeCompare(labelOf(b), 'zh-Hans-CN'))
    case 'name-desc':
      return sorted.sort((a, b) => labelOf(b).localeCompare(labelOf(a), 'zh-Hans-CN'))
    case 'updated-desc':
      return sorted.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    case 'updated-asc':
      return sorted.sort((a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''))
    case 'favorites-first':
      return sorted.sort((a, b) => (b.is_favorite || 0) - (a.is_favorite || 0) || a.sort_order - b.sort_order)
    case 'random':
      return sorted.sort((a, b) => a.id.localeCompare(b.id)).sort(() => Math.random() - 0.5)
    case 'manual':
    default:
      return sorted.sort((a, b) => a.sort_order - b.sort_order || labelOf(a).localeCompare(labelOf(b), 'zh-Hans-CN'))
  }
}
