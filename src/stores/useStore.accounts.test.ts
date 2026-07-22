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

  it('keeps the selected account mounted when a filtered refresh happens during an unsaved draft', async () => {
    const { useStore } = await import('./useStore')
    useStore.setState({
      selectedAccountId: 'account-1',
      navigationBlockReason: '账号修改尚未保存',
    })

    await useStore.getState().loadAccounts()

    expect(useStore.getState().selectedAccountId).toBe('account-1')
  })

  it('clears a filtered-out selection when there is no unfinished draft', async () => {
    const { useStore } = await import('./useStore')
    useStore.setState({ selectedAccountId: 'account-1', navigationBlockReason: null })

    await useStore.getState().loadAccounts()

    expect(useStore.getState().selectedAccountId).toBeNull()
  })

  it('reports a committed 2FA create separately from refresh failures', async () => {
    const createTotpAccount = vi.fn(async (data: { id: string }) => ({ id: data.id, created: true }))
    vi.stubGlobal('window', {
      electronAPI: {
        createTotpAccount,
        getTotpAccounts: vi.fn().mockRejectedValue(new Error('simulated refresh failure')),
        getAccounts: vi.fn().mockResolvedValue([]),
      },
    })
    const { useStore } = await import('./useStore')

    const result = await useStore.getState().createTotpAccount({
      issuer: 'Example',
      label: 'owner',
      secret: 'JBSWY3DPEHPK3PXP',
    })

    expect(result.id).toBeTruthy()
    expect(result.refreshFailed).toBe(true)
    expect(createTotpAccount).toHaveBeenCalledTimes(1)
  })

  it('keeps the current account selected when a stale delete does not commit', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        deleteAccount: vi.fn().mockResolvedValue({ success: false }),
        getAccounts: vi.fn().mockResolvedValue([]),
        getTotpAccounts: vi.fn().mockResolvedValue([]),
      },
    })
    const { useStore } = await import('./useStore')
    useStore.setState({ selectedAccountId: 'account-1' })

    await expect(useStore.getState().deleteAccount('account-1')).rejects.toThrow(/已经在回收站/)
    expect(useStore.getState().selectedAccountId).toBe('account-1')
  })
})
