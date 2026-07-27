import { describe, expect, it } from 'vitest'
import serviceDetailSource from '../components/service-info/ServiceDetail.tsx?raw'
import serviceFormDialogSource from '../components/service-info/ServiceFormDialog.tsx?raw'
import serviceInfoManagerSource from '../components/service-info/ServiceInfoManager.tsx?raw'

describe('service information UI polish', () => {
  it('keeps the service edit action enabled and wired to a dialog', () => {
    expect(serviceDetailSource).toContain('openEditServiceDialog')
    expect(serviceDetailSource).toContain('编辑服务')
    expect(serviceDetailSource).not.toContain('<IconButton size="small" disabled>')
  })

  it('uses roomy dialog content instead of crowding the first field under the title', () => {
    expect(serviceDetailSource).not.toContain('DialogContent sx={{ pt: 2.5 }}')
    expect(serviceFormDialogSource).not.toContain('DialogContent sx={{ pt: 2.5 }}')
    expect(serviceInfoManagerSource).not.toContain('DialogContent sx={{ pt: 2.5 }}')
  })

  it('uses the same full service form for create and edit flows', () => {
    expect(serviceInfoManagerSource).toContain('<ServiceFormDialog')
    expect(serviceInfoManagerSource).toContain('mode="create"')
    expect(serviceDetailSource).toContain('<ServiceFormDialog')
    expect(serviceDetailSource).toContain('mode="edit"')
    expect(serviceFormDialogSource).toContain('Autocomplete')
    expect(serviceFormDialogSource).toContain('freeSolo')
    expect(serviceFormDialogSource).toContain('label="用途说明"')
    expect(serviceFormDialogSource).toContain('label="访问网址"')
    expect(serviceFormDialogSource).toContain('label="关联主账号"')
    expect(serviceFormDialogSource).toContain('label="备注"')
    expect(serviceInfoManagerSource).toContain('buildServiceFormSubmission(serviceForm, groupId)')
    expect(serviceDetailSource).toContain('buildServiceFormSubmission(serviceForm, groupId)')
  })

  it('submits the shared form with native form semantics', () => {
    expect(serviceFormDialogSource).toContain("component: 'form'")
    expect(serviceFormDialogSource).toContain('event.preventDefault()')
    expect(serviceFormDialogSource).toContain('type="submit"')
    expect(serviceFormDialogSource).toContain('type="button"')
    expect(serviceFormDialogSource).toContain('multiline')
  })

  it('offers a Base URL and API Key preset through fixed field labels', () => {
    expect(serviceFormDialogSource).toContain('Base URL + API Key')
    expect(serviceFormDialogSource).toContain('label="Base URL"')
    expect(serviceFormDialogSource).toContain('label="API Key"')
    expect(serviceInfoManagerSource).toContain('buildServicePresetFields(serviceForm)')
    expect(serviceInfoManagerSource).toContain('window.electronAPI.createSecretField')
    expect(serviceDetailSource).toContain('servicePresetFieldsNeedSaving(serviceForm, fields)')
    expect(serviceDetailSource).toContain('findPresetField(fields, presetField.fieldName)')
  })

  it('submits editable service forms with Enter without hijacking multiline or combobox input', () => {
    expect(serviceFormDialogSource).toContain("component: 'form'")
    expect(serviceFormDialogSource).toContain("document.activeElement?.getAttribute('role') === 'combobox'")
    expect(serviceFormDialogSource).toContain('type="submit"')
    expect(serviceInfoManagerSource).toContain('if (!mutationBusy && groupName.trim()) void saveGroup()')
    expect(serviceDetailSource).toContain('if (!mutationBusy && fieldName.trim()) void saveField()')
    expect(serviceDetailSource).toContain('if (!mutationBusy && groupName.trim()) void saveGroup()')
  })
})
