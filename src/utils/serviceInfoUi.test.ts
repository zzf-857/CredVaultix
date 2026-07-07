import { describe, expect, it } from 'vitest'
import serviceDetailSource from '../components/service-info/ServiceDetail.tsx?raw'
import serviceInfoManagerSource from '../components/service-info/ServiceInfoManager.tsx?raw'

describe('service information UI polish', () => {
  it('keeps the service edit action enabled and wired to a dialog', () => {
    expect(serviceDetailSource).toContain('openEditServiceDialog')
    expect(serviceDetailSource).toContain('编辑服务')
    expect(serviceDetailSource).not.toContain('<IconButton size="small" disabled>')
  })

  it('uses roomy dialog content instead of crowding the first field under the title', () => {
    expect(serviceDetailSource).not.toContain('DialogContent sx={{ pt: 2.5 }}')
    expect(serviceInfoManagerSource).not.toContain('DialogContent sx={{ pt: 2.5 }}')
  })

  it('creates services by selecting or typing a group instead of entering a purpose field', () => {
    expect(serviceInfoManagerSource).toContain('Autocomplete')
    expect(serviceInfoManagerSource).toContain('freeSolo')
    expect(serviceInfoManagerSource).toContain('groupInputValue')
    expect(serviceInfoManagerSource).toContain('groupId:')
    expect(serviceInfoManagerSource).not.toContain('label="用途"')
  })
})
