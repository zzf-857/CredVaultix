import { describe, expect, it } from 'vitest'
import serviceDetailSource from '../components/service-info/ServiceDetail.tsx?raw'
import serviceInfoManagerSource from '../components/service-info/ServiceInfoManager.tsx?raw'

describe('service information interactions', () => {
  it('uses non-blocking in-app confirmation and feedback instead of browser dialogs', () => {
    const combinedSource = `${serviceDetailSource}\n${serviceInfoManagerSource}`

    expect(combinedSource).not.toContain('window.confirm')
    expect(combinedSource).not.toContain('window.alert')
    expect(serviceDetailSource).toContain('确认删除服务')
    expect(serviceDetailSource).toContain('服务会进入回收站')
    expect(serviceDetailSource).toContain('<Snackbar')
    expect(serviceInfoManagerSource).toContain('分组内服务不会被删除')
  })
})
