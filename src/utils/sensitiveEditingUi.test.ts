import { describe, expect, it } from 'vitest'
import accountsViewSource from '../components/AccountsView.tsx?raw'
import twoFactorPanelSource from '../components/TwoFactorPanel.tsx?raw'
import serviceDetailSource from '../components/service-info/ServiceDetail.tsx?raw'

describe('sensitive value editing controls', () => {
  it('masks account passwords, 2FA secrets, and sensitive custom fields until revealed', () => {
    expect(accountsViewSource).toContain("type={isSecretField && !visible ? 'password' : 'text'}")
    expect(accountsViewSource).toContain("type={newFieldIsSecret && !newFieldValueVisible ? 'password' : 'text'}")
    expect(accountsViewSource).toContain("type={linkSecretVisible ? 'text' : 'password'}")
  })

  it('masks sensitive service fields and persistent 2FA secrets until revealed', () => {
    expect(serviceDetailSource).toContain("type={fieldIsSecret && !fieldValueVisible ? 'password' : 'text'}")
    expect(twoFactorPanelSource).toContain("type={secretVisible ? 'text' : 'password'}")
    expect(twoFactorPanelSource).toContain("type={tempSecretVisible ? 'text' : 'password'}")
  })

  it('treats an unfinished custom field editor as unsaved navigation state', () => {
    expect(accountsViewSource).toContain("? '自定义字段修改尚未保存'")
    expect(accountsViewSource).toContain('hasUnsavedAccountChanges')
    expect(accountsViewSource).toContain('hasUnsavedCustomFieldChanges')
  })
})
