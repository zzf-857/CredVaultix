import type { AppPreferences, ServiceInfoSortMode } from '../types'

const SERVICE_SORT_MODES = new Set<ServiceInfoSortMode>([
  'manual',
  'favorites-first',
  'name-asc',
  'name-desc',
  'updated-desc',
  'updated-asc',
  'random',
])

function sanitizeIdList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return Array.from(new Set(value.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))))
}

export function resolveAppPreferences(
  preferences: AppPreferences,
  legacyPinnedIds: unknown,
  legacyCustomOrder: unknown
) {
  const storedPinnedIds = sanitizeIdList(preferences.accountsPinnedIds)
  const storedCustomOrder = sanitizeIdList(preferences.accountsCustomOrder)
  const accountsPinnedIds = storedPinnedIds ?? sanitizeIdList(legacyPinnedIds) ?? []
  const accountsCustomOrder = storedCustomOrder ?? sanitizeIdList(legacyCustomOrder) ?? []
  const serviceSortMode = SERVICE_SORT_MODES.has(preferences.serviceSortMode as ServiceInfoSortMode)
    ? preferences.serviceSortMode as ServiceInfoSortMode
    : 'manual'

  return {
    accountsPinnedIds,
    accountsCustomOrder,
    themeMode: preferences.themeMode === 'light' ? 'light' as const : 'dark' as const,
    serviceSortMode,
    needsAccountPreferenceMigration: storedPinnedIds === null || storedCustomOrder === null,
  }
}
