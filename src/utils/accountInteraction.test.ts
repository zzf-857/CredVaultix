import { describe, expect, it } from 'vitest'
import mainSource from '../../electron/main.ts?raw'
import accountLifecycleSource from '../../electron/accountLifecycleRepository.ts?raw'
import accountsViewSource from '../components/AccountsView.tsx?raw'
import twoFactorSource from '../components/TwoFactorPanel.tsx?raw'
import storeSource from '../stores/useStore.ts?raw'

describe('account interaction safeguards', () => {
  it('submits account diffs and refreshes both account and 2FA state', () => {
    expect(accountsViewSource).toContain('buildAccountUpdatePatch(account')
    expect(accountsViewSource).toContain('normalizeOtpInput(patch.totpSecret)')
    expect(accountsViewSource).toContain('result.needsTotpLink')
    expect(accountsViewSource).toContain('loadTotpAccounts()')
    expect(storeSource).toContain('get().loadTotpAccounts()')
  })

  it('keeps tag and custom-field mutations from resetting an unfinished account draft', () => {
    expect(accountsViewSource.match(/preserveDraft: true/g)).toHaveLength(4)
    expect(accountsViewSource).toContain('!event.nativeEvent.isComposing')
    expect(accountsViewSource).toContain('从当前账号移除标签')
  })

  it('routes deletion through the unsaved-change guard and merges filtered sorting', () => {
    expect(accountsViewSource).toContain("{ kind: 'delete'; accountId: string }")
    expect(accountsViewSource).toContain("setPendingAccountAction({ kind: 'delete', accountId })")
    expect(accountsViewSource).toContain('mergeVisibleAccountOrder(')
  })

  it('keeps linked account synchronization inside main-process transactions', () => {
    expect(mainSource).toContain('updateAccountRecord(db, id, data, { encrypt })')
    expect(mainSource).toContain('createTotpRecord(db, data, { encrypt })')
    expect(mainSource).toContain('deleteTotpRecord(db, id, { encrypt })')
    expect(twoFactorSource).not.toContain('window.electronAPI.updateAccount(editingTarget.linked_account_id')
  })

  it('distinguishes stale lifecycle operations and committed refresh failures', () => {
    expect(accountLifecycleSource).toContain('WHERE id = ? AND is_deleted = 0')
    expect(accountLifecycleSource).toContain('WHERE id = ? AND is_deleted = 1')
    expect(storeSource).toContain('Promise.allSettled(refreshes)')
    expect(twoFactorSource).toContain("setLoadState('error')")
    expect(twoFactorSource).toContain('counterBusyRef.current')
  })
})
