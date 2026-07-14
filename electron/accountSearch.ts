export interface SearchableAccount {
  name?: string | null
  username?: string | null
  phone?: string | null
  backup_email?: string | null
  notes?: string | null
  tags?: Array<{ name?: string | null }>
}

export function accountMatchesSearch(account: SearchableAccount, query: string): boolean {
  const keyword = query.trim().toLocaleLowerCase()
  if (!keyword) return true

  return [
    account.name,
    account.username,
    account.phone,
    account.backup_email,
    account.notes,
    ...(account.tags || []).map((tag) => tag.name),
  ].some((value) => String(value || '').toLocaleLowerCase().includes(keyword))
}
