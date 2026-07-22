import { describe, expect, it } from 'vitest'
import serviceDetailSource from './ServiceDetail.tsx?raw'

const getHandlerSource = (name: string, nextName: string) => {
  const start = serviceDetailSource.indexOf(`const ${name} =`)
  const end = serviceDetailSource.indexOf(`const ${nextName} =`, start)
  return serviceDetailSource.slice(start, end)
}

describe('ServiceDetail mutation safety', () => {
  it('serializes mutations and checks every structured success result', () => {
    const structuredMutationCalls = serviceDetailSource.match(
      /window\.electronAPI\.(?:updateSecretService|deleteSecretService|updateSecretFieldGroup|deleteSecretFieldGroup|updateSecretField|deleteSecretField|moveSecretFields|reorderSecretFields)\(/g
    ) || []
    const successChecks = serviceDetailSource.match(/assertMutationSucceeded\(/g) || []

    expect(serviceDetailSource).toContain('mutationBusyRef.current')
    expect(structuredMutationCalls).toHaveLength(13)
    expect(successChecks).toHaveLength(structuredMutationCalls.length)
  })

  it('settles list and detail refreshes without turning a committed write into a save failure', () => {
    expect(serviceDetailSource).toContain('Promise.allSettled([')
    expect(serviceDetailSource).toContain("severity: refreshFailed ? 'info' : 'success'")
    expect(serviceDetailSource).toContain('服务信息已保存但刷新失败')
    expect(serviceDetailSource).toContain('字段已${action}但刷新失败')
    expect(serviceDetailSource).toContain('字段组已${action}但刷新失败')
  })

  it('closes committed edit and delete states before refreshing', () => {
    const saveService = getHandlerSource('saveService', 'openCreateFieldDialog')
    const saveField = getHandlerSource('saveField', 'deleteField')
    const saveGroup = getHandlerSource('saveGroup', 'deleteGroup')
    const confirmDelete = getHandlerSource('confirmDelete', 'dropBeforeField')

    expect(saveService.indexOf('setServiceDialogOpen(false)')).toBeLessThan(saveService.indexOf('refreshServiceData'))
    expect(saveField.indexOf('setFieldDialogOpen(false)')).toBeLessThan(saveField.indexOf('refreshServiceData'))
    expect(saveGroup.indexOf('setGroupDialogOpen(false)')).toBeLessThan(saveGroup.indexOf('refreshServiceData'))
    expect(confirmDelete.indexOf('setDeleteTarget(null)')).toBeLessThan(confirmDelete.indexOf('refreshServiceData'))
  })

  it('keeps a created group committed when the optional field move fails', () => {
    const saveGroup = getHandlerSource('saveGroup', 'deleteGroup')

    expect(saveGroup).toContain('let moveError: unknown = null')
    expect(saveGroup).toContain('字段组已创建，但移动所选字段失败')
    expect(saveGroup.indexOf('setGroupDialogOpen(false)')).toBeLessThan(saveGroup.indexOf('moveSecretFields'))
  })
})
