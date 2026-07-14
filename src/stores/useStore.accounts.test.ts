import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('account store loading', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('window', {
      electronAPI: {
        getAccounts: vi.fn().mockResolvedValue([]),
      },
    })
  })

  it('does not leak the main account search and platform filters into the recycle bin', async () => {
    const { useStore } = await import('./useStore')
    useStore.setState({ accountSearchQuery: 'github', accountPlatformFilter: 'google' })

    await useStore.getState().loadTrashAccounts()

    expect(window.electronAPI.getAccounts).toHaveBeenCalledWith({
      isDeleted: true,
      platform: 'all',
    })
  })

  it('loads an unfiltered relationship list without replacing the visible filtered list', async () => {
    const { useStore } = await import('./useStore')
    const visibleAccount = { id: 'visible' }
    const linkedAccount = { id: 'linked' }
    useStore.setState({ accounts: [visibleAccount] as any })
    vi.mocked(window.electronAPI.getAccounts).mockResolvedValueOnce([linkedAccount] as any)

    await useStore.getState().loadAllAccounts()

    expect(window.electronAPI.getAccounts).toHaveBeenCalledWith({ isDeleted: false, platform: 'all' })
    expect(useStore.getState().accounts).toEqual([visibleAccount])
    expect(useStore.getState().allAccounts).toEqual([linkedAccount])
  })

  it('clears stale account filters when navigating from a linked 2FA or service record', async () => {
    const { useStore } = await import('./useStore')
    useStore.setState({ accountSearchQuery: 'other account', accountPlatformFilter: 'microsoft' })

    useStore.getState().navigateToAccount('target-account')

    expect(useStore.getState()).toMatchObject({
      activeView: 'accounts',
      selectedAccountId: 'target-account',
      accountSearchQuery: '',
      accountPlatformFilter: 'all',
    })
  })
})
