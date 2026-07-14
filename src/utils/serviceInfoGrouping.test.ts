import { describe, expect, it } from 'vitest'
import {
  getGroupedItems,
  moveItemsToGroup,
  reorderItems,
  moveIdsBefore,
  sortServiceInfoItems,
} from './serviceInfoGrouping'

interface Item {
  id: string
  group_id: string | null
  name: string
  sort_order: number
  updated_at: string
  is_favorite?: number
}

describe('serviceInfoGrouping', () => {
  const items: Item[] = [
    { id: 'a', group_id: null, name: 'Alpha', sort_order: 2, updated_at: '2026-07-01T01:00:00.000Z' },
    { id: 'b', group_id: 'g1', name: 'Beta', sort_order: 1, updated_at: '2026-07-01T02:00:00.000Z', is_favorite: 1 },
    { id: 'c', group_id: 'g1', name: 'Gamma', sort_order: 2, updated_at: '2026-07-01T03:00:00.000Z' },
  ]

  it('groups items by nullable group id', () => {
    expect(getGroupedItems(items)).toEqual({
      ungrouped: [items[0]],
      groups: {
        g1: [items[1], items[2]],
      },
    })
  })

  it('moves selected items into a group without dropping other items', () => {
    expect(moveItemsToGroup(items, ['a', 'c'], 'g2').map((item) => [item.id, item.group_id])).toEqual([
      ['a', 'g2'],
      ['b', 'g1'],
      ['c', 'g2'],
    ])
  })

  it('moves selected items out to ungrouped', () => {
    expect(moveItemsToGroup(items, ['b'], null).find((item) => item.id === 'b')?.group_id).toBeNull()
  })

  it('reorders only the supplied ids', () => {
    expect(reorderItems(items, ['c', 'b']).map((item) => [item.id, item.sort_order])).toEqual([
      ['a', 2],
      ['b', 2],
      ['c', 1],
    ])
  })

  it('moves one or more selected ids before the drop target without duplicates', () => {
    expect(moveIdsBefore(['a', 'b', 'c', 'd'], ['d', 'b'], 'c')).toEqual(['a', 'b', 'd', 'c'])
    expect(moveIdsBefore(['a', 'b', 'c'], ['b'], 'b')).toEqual(['a', 'b', 'c'])
  })

  it('sorts services by favorite first', () => {
    expect(sortServiceInfoItems(items, 'favorites-first').map((item) => item.id)).toEqual(['b', 'a', 'c'])
  })
})
