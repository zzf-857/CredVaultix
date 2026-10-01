import { ACCOUNT_PLATFORM_OPTIONS, normalizeAccountPlatform, type AccountPlatform } from './accountPlatform'

export const TOTP_SOURCE_MAX_LENGTH = 80

export function normalizeTotpSource(value?: string | null) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, TOTP_SOURCE_MAX_LENGTH)
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function formatLocalDate(now: Date) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function formatLocalTime(now: Date) {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function suggestGoogleMigrationSourceName(existingSources: string[] = [], now = new Date()) {
  const date = formatLocalDate(now)
  const base = `Google Authenticator · ${date}`
  const taken = new Set(existingSources.map(normalizeTotpSource).filter(Boolean))
  if (!taken.has(base)) return base

  const withTime = `${base} ${formatLocalTime(now)}`
  if (!taken.has(withTime)) return withTime

  let index = 2
  while (taken.has(`${base} (${index})`)) index += 1
  return `${base} (${index})`
}

export function totpSourceGroupId(source: string) {
  const normalized = normalizeTotpSource(source)
  let hash = 2166136261
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `group-source-${(hash >>> 0).toString(36)}`
}

export function suggestSingleImportSourceName(
  issuer?: string | null,
  label?: string | null,
  existingSources: string[] = [],
  now = new Date(),
) {
  const base = normalizeTotpSource(issuer) || normalizeTotpSource(label) || `新分组 · ${formatLocalDate(now)}`
  const taken = new Set(existingSources.map(normalizeTotpSource).filter(Boolean))
  if (!taken.has(base)) return base
  let index = 2
  while (taken.has(`${base} (${index})`)) index += 1
  return `${base} (${index})`
}

export function sanitizeTotpGroupIdList(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))))
}

export function applyTotpGroupOrder(visibleIds: string[], savedOrder: string[] = []) {
  const visible = new Set(visibleIds)
  const ordered = savedOrder.filter((id) => visible.has(id))
  const leftover = visibleIds.filter((id) => !ordered.includes(id))
  return [...ordered, ...leftover]
}

export function rememberTotpGroupAtEnd(visibleIds: string[], savedOrder: string[], groupId: string) {
  const current = applyTotpGroupOrder(visibleIds, savedOrder)
  if (current.includes(groupId)) return current
  return [...current, groupId]
}

export function moveTotpGroupId(order: string[], fromId: string, toId: string) {
  const next = [...order]
  const from = next.indexOf(fromId)
  const to = next.indexOf(toId)
  if (from < 0 || to < 0 || from === to) return order
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function toggleTotpGroupCollapsed(collapsedIds: string[], groupId: string) {
  return collapsedIds.includes(groupId)
    ? collapsedIds.filter((id) => id !== groupId)
    : [...collapsedIds, groupId]
}

export function groupTotpAccountsBySource<T extends { source?: string | null }>(accounts: T[]) {
  const sourced = new Map<string, T[]>()
  const unsourced: T[] = []

  for (const account of accounts) {
    const source = normalizeTotpSource(account.source)
    if (!source) {
      unsourced.push(account)
      continue
    }
    const list = sourced.get(source)
    if (list) list.push(account)
    else sourced.set(source, [account])
  }

  return {
    sourceGroups: Array.from(sourced.entries())
      .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
      .map(([source, groupAccounts]) => ({
        source,
        accounts: groupAccounts,
        groupId: totpSourceGroupId(source),
      })),
    unsourced,
  }
}

interface TotpPlatformAccount {
  linked_account_id?: string | null
  label?: string | null
  issuer?: string | null
}

interface LinkedPlatformAccount {
  id: string
  platform?: string | null
}

const ISSUER_PLATFORM_PATTERNS: ReadonlyArray<readonly [AccountPlatform, RegExp]> = [
  ['google', /(?:^|[^a-z0-9])(?:google|gmail)(?:$|[^a-z0-9])/i],
  ['microsoft', /(?:^|[^a-z0-9])(?:microsoft|outlook|hotmail)(?:$|[^a-z0-9])/i],
  ['github', /(?:^|[^a-z0-9])github(?:$|[^a-z0-9])/i],
  ['qq', /(?:^|[^a-z0-9])qq(?:$|[^a-z0-9])/i],
  ['apple', /(?:^|[^a-z0-9])(?:apple|icloud)(?:$|[^a-z0-9])/i],
]

export function getTotpAccountPlatform(
  account: TotpPlatformAccount,
  linkedAccounts: readonly LinkedPlatformAccount[],
): AccountPlatform {
  if (account.linked_account_id) {
    const linkedAccount = linkedAccounts.find((item) => item.id === account.linked_account_id)
    if (linkedAccount) return normalizeAccountPlatform(linkedAccount.platform)
  }

  const issuer = account.issuer || ''
  const issuerPlatform = ISSUER_PLATFORM_PATTERNS.find(([, pattern]) => pattern.test(issuer))?.[0]
  if (issuerPlatform) return issuerPlatform

  const label = (account.label || '').toLowerCase()
  if (label.includes('gmail') || label.includes('google')) {
    return 'google'
  }
  if (['outlook', 'hotmail', '@live.com', 'microsoft'].some((value) => label.includes(value))) {
    return 'microsoft'
  }
  if (label.includes('github')) return 'github'
  if (label.includes('@qq.com')) return 'qq'
  if (
    ['@icloud.com', '@me.com', '@mac.com'].some((value) => label.includes(value))
    || /(?:^|[^a-z0-9])apple(?:$|[^a-z0-9])/.test(label)
  ) {
    return 'apple'
  }
  return 'other'
}

export function groupTotpAccountsByPlatform<T extends TotpPlatformAccount>(
  accounts: T[],
  linkedAccounts: readonly LinkedPlatformAccount[],
) {
  const grouped = new Map<AccountPlatform, T[]>()
  for (const account of accounts) {
    const platform = getTotpAccountPlatform(account, linkedAccounts)
    const list = grouped.get(platform)
    if (list) list.push(account)
    else grouped.set(platform, [account])
  }
  const platforms: AccountPlatform[] = [...ACCOUNT_PLATFORM_OPTIONS.map((option) => option.platform), 'other']
  return platforms.flatMap((platform) => {
    const groupAccounts = grouped.get(platform)
    return groupAccounts?.length ? [{ platform, accounts: groupAccounts, groupId: `group-${platform}` }] : []
  })
}
