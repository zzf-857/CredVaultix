import { describe, expect, it } from 'vitest'
import accountLifecycleSource from '../../electron/accountLifecycleRepository.ts?raw'
import accountsIpcSource from '../../electron/ipc/accountsIpc.ts?raw'
import totpIpcSource from '../../electron/ipc/totpIpc.ts?raw'
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
    expect(accountsViewSource.match(/preserveDraft: true/g)).toHaveLength(5)
    expect(accountsViewSource).toContain("import { shouldSubmitOnEnter } from '../utils/quickSubmit'")
    expect(accountsViewSource).toContain('onKeyDown={handleTagQuickSubmit}')
    expect(accountsViewSource).toContain('onKeyDown={handleCustomFieldQuickSubmit}')
    expect(accountsViewSource).toContain('从当前账号移除标签')
    expect(accountsViewSource).toContain('handleConfirmDeleteTag')
    expect(accountsViewSource).toContain('scrollIntoView({ block: \'center\'')
    expect(accountsViewSource).toContain('data-account-id={account.id}')
    expect(accountsViewSource).toContain('<TagManagerDialog')
  })

  it('scopes account Enter shortcuts to their own non-busy mutation', () => {
    const accountSubmitSource = accountsViewSource.slice(
      accountsViewSource.indexOf('const handleAccountQuickSubmit'),
      accountsViewSource.indexOf('const handleConfirmLink')
    )
    const customFieldSubmitSource = accountsViewSource.slice(
      accountsViewSource.indexOf('const handleCustomFieldQuickSubmit'),
      accountsViewSource.indexOf('const handleConfirmDeleteField')
    )
    const tagSubmitSource = accountsViewSource.slice(
      accountsViewSource.indexOf('const handleTagQuickSubmit'),
      accountsViewSource.indexOf('const handleRemoveTag')
    )

    expect(accountSubmitSource).toContain('saveBusy')
    expect(accountSubmitSource).toContain('!editData.name.trim()')
    expect(accountSubmitSource).toContain('!hasUnsavedAccountChanges')
    expect(accountSubmitSource).toContain('shouldSubmitOnEnter(event)')
    expect(customFieldSubmitSource).toContain('fieldBusy || !newFieldName.trim()')
    expect(customFieldSubmitSource).toContain('shouldSubmitOnEnter(event)')
    expect(tagSubmitSource).toContain('tagBusy || !newTagName.trim()')
    expect(tagSubmitSource).toContain('shouldSubmitOnEnter(event)')
    expect(accountsViewSource).toContain('onQuickSubmit={handleAccountQuickSubmit}')
    expect(accountsViewSource).toContain('multiline={!newFieldIsSecret}')
  })

  it('uses one native submit path for account linking and permanent 2FA forms', () => {
    const linkDialogSource = accountsViewSource.slice(
      accountsViewSource.indexOf('open={linkTotpDialogOpen}'),
      accountsViewSource.indexOf('<Dialog open={customFieldDeleteId')
    )
    const tempDialogSource = twoFactorSource.slice(
      twoFactorSource.indexOf('Temporary Authenticator Dialog'),
      twoFactorSource.indexOf('Add Account Dialog')
    )
    const accountDialogSource = twoFactorSource.slice(
      twoFactorSource.indexOf('Add Account Dialog'),
      twoFactorSource.indexOf('Delete Confirmation Dialog')
    )
    const deleteDialogSource = twoFactorSource.slice(
      twoFactorSource.indexOf('Delete Confirmation Dialog')
    )

    expect(linkDialogSource).toContain("component: 'form'")
    expect(linkDialogSource).toContain('onSubmit: (event: React.FormEvent<HTMLFormElement>)')
    expect(linkDialogSource).not.toContain('onKeyDown:')
    expect(linkDialogSource).toContain('<Button type="button" onClick={handleSkipLink}')
    expect(linkDialogSource).toContain('<Button type="submit" variant="contained"')

    expect(accountDialogSource).toContain("component: 'form'")
    expect(accountDialogSource).toContain('noValidate: true')
    expect(accountDialogSource).toContain('if (!mutationBusy) void handleAdd()')
    expect(accountDialogSource).not.toContain('onKeyDown:')
    expect(accountDialogSource).not.toContain('onClick={handleAdd}')
    expect(accountDialogSource).toContain('<Button type="submit" variant="contained"')
    expect(accountDialogSource).toContain('multiline')

    expect(tempDialogSource).not.toContain("component: 'form'")
    expect(deleteDialogSource).not.toContain("component: 'form'")
  })

  it('closes the add dialog for dragged migration QR codes and clears temporary secrets when promoting them', () => {
    const qrHandlerSource = twoFactorSource.slice(
      twoFactorSource.indexOf('const handleQrFile ='),
      twoFactorSource.indexOf('const loadStoredQrPreview =')
    )
    const promoteTemporarySource = twoFactorSource.slice(
      twoFactorSource.indexOf('const handleSaveTempToPermanent ='),
      twoFactorSource.indexOf('const cancelQrFormRequest =')
    )

    expect(qrHandlerSource).toContain("if (decoded.kind === 'migration')")
    expect(qrHandlerSource).toContain('resetDialog()')
    expect(qrHandlerSource).not.toContain('if (dialogOpen) resetDialog()')
    expect(promoteTemporarySource).toContain('resetTempDialog()')
    expect(promoteTemporarySource).not.toContain('setTempDialogOpen(false)')
  })

  it('routes deletion through the unsaved-change guard and merges filtered sorting', () => {
    expect(accountsViewSource).toContain("{ kind: 'delete'; accountId: string }")
    expect(accountsViewSource).toContain("setPendingAccountAction({ kind: 'delete', accountId })")
    expect(accountsViewSource).toContain('mergeVisibleAccountOrder(')
  })

  it('keeps linked account synchronization inside main-process transactions', () => {
    expect(accountsIpcSource).toContain('updateAccountRecord(options.getDatabase(), id, data, { encrypt, decrypt })')
    expect(totpIpcSource).toContain('createTotpRecord(')
    expect(totpIpcSource).toContain('prepareTotpWriteData(data)')
    expect(totpIpcSource).toContain('deleteTotpRecord(options.getDatabase(), id, { encrypt })')
    expect(twoFactorSource).not.toContain('window.electronAPI.updateAccount(editingTarget.linked_account_id')
  })

  it('distinguishes stale lifecycle operations and committed refresh failures', () => {
    expect(accountLifecycleSource).toContain('WHERE id = ? AND is_deleted = 0')
    expect(accountLifecycleSource).toContain('WHERE id = ? AND is_deleted = 1')
    expect(storeSource).toContain('Promise.allSettled(refreshes)')
    expect(twoFactorSource).toContain("setLoadState('error')")
    expect(twoFactorSource).toContain('counterBusyRef.current')
  })

  it('keeps Google Authenticator imports in a named source group', () => {
    const migrationImportSource = twoFactorSource.slice(
      twoFactorSource.indexOf('const handleMigrationImport ='),
      twoFactorSource.indexOf('const handleRequestDelete =')
    )

    expect(twoFactorSource).toContain('groupTotpAccountsBySource')
    expect(twoFactorSource).toContain('来源名称')
    expect(twoFactorSource).toContain('source,')
    expect(twoFactorSource).toContain('加入现有分组')
    expect(twoFactorSource).toContain('rememberTotpGroupAtEnd')
    expect(twoFactorSource).toContain('draggable')
    expect(twoFactorSource).toContain('onToggle={groupId ? () => persistCollapsedGroups')
    expect(migrationImportSource).toContain('await createTotpAccounts(migrationEntries.map')
    expect(migrationImportSource).not.toContain('for (const entry of migrationEntries)')
    expect(migrationImportSource).toContain('批量导入失败')
  })
})
