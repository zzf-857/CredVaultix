import { app, ipcMain, shell } from 'electron'
import type Database from 'better-sqlite3'
import { decrypt, encrypt } from './crypto'

function nowIso() {
  return new Date().toISOString()
}

function normalizeNullableId(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function normalizeBatchIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return null
  if (value.some((id) => typeof id !== 'string' || !id.trim())) return null

  const ids = value as string[]
  return new Set(ids).size === ids.length ? ids : null
}

function requireName(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required`)
  }

  return value.trim()
}

function normalizeLinkedAccountId(db: Database.Database, value: unknown) {
  const linkedAccountId = normalizeNullableId(value)
  if (!linkedAccountId) return null

  const row = db.prepare('SELECT id FROM accounts WHERE id = ?').get(linkedAccountId) as { id?: string } | undefined
  return row?.id || null
}

function nextServiceSortOrder(db: Database.Database, groupId: string | null) {
  const row = groupId
    ? db.prepare('SELECT MAX(sort_order) as maxOrder FROM secret_services WHERE group_id = ?').get(groupId)
    : db.prepare('SELECT MAX(sort_order) as maxOrder FROM secret_services WHERE group_id IS NULL').get()
  return (((row as { maxOrder?: number | null } | undefined)?.maxOrder) || 0) + 1
}

function nextFieldGroupSortOrder(db: Database.Database, serviceId: string) {
  const row = db
    .prepare('SELECT MAX(sort_order) as maxOrder FROM secret_field_groups WHERE service_id = ?')
    .get(serviceId) as { maxOrder?: number | null } | undefined
  return (row?.maxOrder || 0) + 1
}

function nextFieldSortOrder(db: Database.Database, serviceId: string, groupId: string | null) {
  const row = groupId
    ? db.prepare('SELECT MAX(sort_order) as maxOrder FROM secret_fields WHERE service_id = ? AND group_id = ?').get(serviceId, groupId)
    : db.prepare('SELECT MAX(sort_order) as maxOrder FROM secret_fields WHERE service_id = ? AND group_id IS NULL').get(serviceId)
  return (((row as { maxOrder?: number | null } | undefined)?.maxOrder) || 0) + 1
}

function updateServiceTimestamp(db: Database.Database, serviceId: string) {
  db.prepare('UPDATE secret_services SET updated_at = ? WHERE id = ?').run(nowIso(), serviceId)
}

function secretGroupExists(db: Database.Database, groupId: string | null) {
  if (!groupId) return true
  return Boolean(db.prepare('SELECT id FROM secret_groups WHERE id = ?').get(groupId))
}

function activeServicesExist(db: Database.Database, ids: string[]) {
  const findService = db.prepare('SELECT id FROM secret_services WHERE id = ? AND is_deleted = 0')
  return ids.every((id) => Boolean(findService.get(id)))
}

function getFieldServiceId(db: Database.Database, ids: string[]) {
  const findField = db.prepare('SELECT service_id FROM secret_fields WHERE id = ?')
  let serviceId: string | null = null

  for (const id of ids) {
    const field = findField.get(id) as { service_id?: string } | undefined
    if (!field?.service_id) return null
    if (serviceId && field.service_id !== serviceId) return null
    serviceId = field.service_id
  }

  return serviceId
}

function fieldGroupBelongsToService(db: Database.Database, groupId: string | null, serviceId: string) {
  if (!groupId) return true
  const group = db
    .prepare('SELECT service_id FROM secret_field_groups WHERE id = ?')
    .get(groupId) as { service_id?: string } | undefined
  return group?.service_id === serviceId
}

function requireSingleChange(result: Database.RunResult) {
  if (result.changes !== 1) {
    throw new Error('The requested record changed before the operation completed')
  }
}

export function registerServiceInfoIpc(initialDatabase: Database.Database) {
  let db = initialDatabase
  ipcMain.handle('serviceInfo:getAll', () => ({
    groups: db.prepare('SELECT * FROM secret_groups ORDER BY sort_order ASC, name ASC').all(),
    services: db.prepare('SELECT * FROM secret_services WHERE is_deleted = 0 ORDER BY sort_order ASC, updated_at DESC').all(),
  }))

  ipcMain.handle('serviceInfo:getDetail', (_event, serviceId: string) => {
    const service = db.prepare('SELECT * FROM secret_services WHERE id = ? AND is_deleted = 0').get(serviceId)
    if (!service) return null

    const fieldGroups = db
      .prepare('SELECT * FROM secret_field_groups WHERE service_id = ? ORDER BY sort_order ASC, name ASC')
      .all(serviceId)
    const fields = (db
      .prepare('SELECT * FROM secret_fields WHERE service_id = ? ORDER BY sort_order ASC, field_name ASC')
      .all(serviceId) as any[]).map((field) => ({
        ...field,
        field_value: field.is_secret ? decrypt(field.field_value) : field.field_value,
      }))

    return { service, fieldGroups, fields }
  })

  ipcMain.handle('serviceInfo:createGroup', (_event, data: { id: string; name: string; color?: string }) => {
    const row = db.prepare('SELECT MAX(sort_order) as maxOrder FROM secret_groups').get() as { maxOrder?: number | null } | undefined
    const sortOrder = (row?.maxOrder || 0) + 1
    db.prepare('INSERT INTO secret_groups (id, name, color, sort_order) VALUES (?, ?, ?, ?)').run(
      data.id,
      requireName(data.name, 'Group name'),
      data.color || '#a8c7fa',
      sortOrder
    )
    return { id: data.id }
  })

  ipcMain.handle('serviceInfo:updateGroup', (_event, id: string, data: { name?: string; color?: string; isCollapsed?: number; sortOrder?: number }) => {
    const updates: string[] = ['updated_at = ?']
    const params: any[] = [nowIso()]
    if (data.name !== undefined) { updates.push('name = ?'); params.push(requireName(data.name, 'Group name')) }
    if (data.color !== undefined) { updates.push('color = ?'); params.push(data.color || '#a8c7fa') }
    if (data.isCollapsed !== undefined) { updates.push('is_collapsed = ?'); params.push(data.isCollapsed ? 1 : 0) }
    if (data.sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(data.sortOrder) }
    params.push(id)
    const result = db.prepare(`UPDATE secret_groups SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    return { success: result.changes === 1 }
  })

  ipcMain.handle('serviceInfo:deleteGroup', (_event, id: string) => {
    return db.transaction(() => {
      const group = db.prepare('SELECT id FROM secret_groups WHERE id = ?').get(id)
      if (!group) return { success: false }

      db.prepare('UPDATE secret_services SET group_id = NULL, updated_at = ? WHERE group_id = ?').run(nowIso(), id)
      requireSingleChange(db.prepare('DELETE FROM secret_groups WHERE id = ?').run(id))
      return { success: true }
    })()
  })

  ipcMain.handle('serviceInfo:createService', (_event, data: any) => {
    const groupId = normalizeNullableId(data.groupId)
    const createdAt = nowIso()
    db.prepare(`
      INSERT INTO secret_services (id, group_id, linked_account_id, name, description, url, notes, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      groupId,
      normalizeLinkedAccountId(db, data.linkedAccountId),
      requireName(data.name, 'Service name'),
      data.description || '',
      data.url || '',
      data.notes || '',
      nextServiceSortOrder(db, groupId),
      createdAt,
      createdAt
    )
    return { id: data.id }
  })

  ipcMain.handle('serviceInfo:updateService', (_event, id: string, data: any) => {
    const updates: string[] = ['updated_at = ?']
    const params: any[] = [nowIso()]
    if (data.groupId !== undefined) { updates.push('group_id = ?'); params.push(normalizeNullableId(data.groupId)) }
    if (data.linkedAccountId !== undefined) { updates.push('linked_account_id = ?'); params.push(normalizeLinkedAccountId(db, data.linkedAccountId)) }
    if (data.name !== undefined) { updates.push('name = ?'); params.push(requireName(data.name, 'Service name')) }
    if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description) }
    if (data.url !== undefined) { updates.push('url = ?'); params.push(data.url) }
    if (data.notes !== undefined) { updates.push('notes = ?'); params.push(data.notes) }
    if (data.isFavorite !== undefined) { updates.push('is_favorite = ?'); params.push(data.isFavorite ? 1 : 0) }
    params.push(id)
    const result = db.prepare(`UPDATE secret_services SET ${updates.join(', ')} WHERE id = ? AND is_deleted = 0`).run(...params)
    return { success: result.changes === 1 }
  })

  ipcMain.handle('serviceInfo:deleteService', (_event, id: string) => {
    const deletedAt = nowIso()
    const result = db.prepare('UPDATE secret_services SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ? AND is_deleted = 0')
      .run(deletedAt, deletedAt, id)
    return { success: result.changes === 1 }
  })

  ipcMain.handle('serviceInfo:getDeletedServices', () => (
    db.prepare('SELECT * FROM secret_services WHERE is_deleted = 1 ORDER BY deleted_at DESC, updated_at DESC').all()
  ))

  ipcMain.handle('serviceInfo:restoreService', (_event, id: string) => {
    const result = db.prepare('UPDATE secret_services SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE id = ? AND is_deleted = 1')
      .run(nowIso(), id)
    return { success: result.changes === 1 }
  })

  ipcMain.handle('serviceInfo:hardDeleteService', (_event, id: string) => {
    const service = db
      .prepare('SELECT is_deleted FROM secret_services WHERE id = ?')
      .get(id) as { is_deleted?: number } | undefined
    if (!service || !service.is_deleted) {
      return { success: false }
    }

    db.transaction(() => {
      db.prepare('DELETE FROM secret_fields WHERE service_id = ?').run(id)
      db.prepare('DELETE FROM secret_field_groups WHERE service_id = ?').run(id)
      db.prepare('DELETE FROM secret_services WHERE id = ?').run(id)
    })()
    return { success: true }
  })

  ipcMain.handle('serviceInfo:moveServices', (_event, data: { ids: string[]; groupId: string | null }) => {
    const ids = normalizeBatchIds(data.ids)
    if (!ids) return { success: false }

    const groupId = normalizeNullableId(data.groupId)
    const updatedAt = nowIso()
    return db.transaction(() => {
      if (!secretGroupExists(db, groupId) || !activeServicesExist(db, ids)) {
        return { success: false }
      }

      let sortOrder = nextServiceSortOrder(db, groupId)
      const moveService = db.prepare(
        'UPDATE secret_services SET group_id = ?, sort_order = ?, updated_at = ? WHERE id = ? AND is_deleted = 0'
      )
      for (const id of ids) {
        requireSingleChange(moveService.run(groupId, sortOrder, updatedAt, id))
        sortOrder += 1
      }
      return { success: true }
    })()
  })

  ipcMain.handle('serviceInfo:reorderServices', (_event, data: { orderedIds: string[]; groupId: string | null }) => {
    const orderedIds = normalizeBatchIds(data.orderedIds)
    if (!orderedIds) return { success: false }

    const groupId = normalizeNullableId(data.groupId)
    const updatedAt = nowIso()
    return db.transaction(() => {
      if (!secretGroupExists(db, groupId) || !activeServicesExist(db, orderedIds)) {
        return { success: false }
      }

      const reorderService = db.prepare(
        'UPDATE secret_services SET group_id = ?, sort_order = ?, updated_at = ? WHERE id = ? AND is_deleted = 0'
      )
      orderedIds.forEach((id, index) => {
        requireSingleChange(reorderService.run(groupId, index + 1, updatedAt, id))
      })
      return { success: true }
    })()
  })

  ipcMain.handle('serviceInfo:createFieldGroup', (_event, data: { id: string; serviceId: string; name: string; color?: string }) => {
    db.prepare('INSERT INTO secret_field_groups (id, service_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)')
      .run(data.id, data.serviceId, requireName(data.name, 'Field group name'), data.color || '#a8c7fa', nextFieldGroupSortOrder(db, data.serviceId))
    updateServiceTimestamp(db, data.serviceId)
    return { id: data.id }
  })

  ipcMain.handle('serviceInfo:updateFieldGroup', (_event, id: string, data: any) => {
    return db.transaction(() => {
      const current = db.prepare('SELECT service_id FROM secret_field_groups WHERE id = ?').get(id) as { service_id?: string } | undefined
      if (!current?.service_id) return { success: false }

      const updates: string[] = ['updated_at = ?']
      const params: any[] = [nowIso()]
      if (data.name !== undefined) { updates.push('name = ?'); params.push(requireName(data.name, 'Field group name')) }
      if (data.color !== undefined) { updates.push('color = ?'); params.push(data.color || '#a8c7fa') }
      if (data.isCollapsed !== undefined) { updates.push('is_collapsed = ?'); params.push(data.isCollapsed ? 1 : 0) }
      if (data.sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(data.sortOrder) }
      params.push(id)
      requireSingleChange(db.prepare(`UPDATE secret_field_groups SET ${updates.join(', ')} WHERE id = ?`).run(...params))
      updateServiceTimestamp(db, current.service_id)
      return { success: true }
    })()
  })

  ipcMain.handle('serviceInfo:deleteFieldGroup', (_event, id: string) => {
    return db.transaction(() => {
      const current = db.prepare('SELECT service_id FROM secret_field_groups WHERE id = ?').get(id) as { service_id?: string } | undefined
      if (!current?.service_id) return { success: false }

      db.prepare('UPDATE secret_fields SET group_id = NULL, updated_at = ? WHERE group_id = ?').run(nowIso(), id)
      requireSingleChange(db.prepare('DELETE FROM secret_field_groups WHERE id = ?').run(id))
      updateServiceTimestamp(db, current.service_id)
      return { success: true }
    })()
  })

  ipcMain.handle('serviceInfo:createField', (_event, data: any) => {
    const isSecret = data.isSecret !== false
    const groupId = normalizeNullableId(data.groupId)
    if (!fieldGroupBelongsToService(db, groupId, data.serviceId)) {
      throw new Error('Field group does not belong to the target service')
    }
    db.prepare(`
      INSERT INTO secret_fields (id, service_id, group_id, field_name, field_value, is_secret, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.serviceId,
      groupId,
      requireName(data.fieldName, 'Field name'),
      isSecret ? encrypt(data.fieldValue || '') : data.fieldValue || '',
      isSecret ? 1 : 0,
      nextFieldSortOrder(db, data.serviceId, groupId)
    )
    updateServiceTimestamp(db, data.serviceId)
    return { id: data.id }
  })

  ipcMain.handle('serviceInfo:updateField', (_event, id: string, data: any) => {
    const current = db
      .prepare('SELECT service_id, field_value, is_secret FROM secret_fields WHERE id = ?')
      .get(id) as { service_id: string; field_value: string; is_secret: number } | undefined

    if (!current) return { success: false }

    const groupId = data.groupId !== undefined ? normalizeNullableId(data.groupId) : undefined
    if (groupId !== undefined && !fieldGroupBelongsToService(db, groupId, current.service_id)) {
      return { success: false }
    }

    const currentIsSecret = Boolean(current.is_secret)
    const nextIsSecret = data.isSecret !== undefined ? Boolean(data.isSecret) : currentIsSecret
    const updates: string[] = ['updated_at = ?']
    const params: any[] = [nowIso()]

    if (data.groupId !== undefined) { updates.push('group_id = ?'); params.push(groupId) }
    if (data.fieldName !== undefined) { updates.push('field_name = ?'); params.push(requireName(data.fieldName, 'Field name')) }
    if (data.fieldValue !== undefined || data.isSecret !== undefined) {
      const plainValue = data.fieldValue !== undefined
        ? data.fieldValue
        : currentIsSecret
          ? decrypt(current.field_value)
          : current.field_value
      updates.push('field_value = ?')
      params.push(nextIsSecret ? encrypt(plainValue) : plainValue)
    }
    if (data.isSecret !== undefined) { updates.push('is_secret = ?'); params.push(nextIsSecret ? 1 : 0) }

    params.push(id)
    return db.transaction(() => {
      const result = db.prepare(`UPDATE secret_fields SET ${updates.join(', ')} WHERE id = ?`).run(...params)
      if (result.changes !== 1) return { success: false }
      updateServiceTimestamp(db, current.service_id)
      return { success: true }
    })()
  })

  ipcMain.handle('serviceInfo:deleteField', (_event, id: string) => {
    return db.transaction(() => {
      const current = db.prepare('SELECT service_id FROM secret_fields WHERE id = ?').get(id) as { service_id?: string } | undefined
      if (!current?.service_id) return { success: false }

      const result = db.prepare('DELETE FROM secret_fields WHERE id = ?').run(id)
      if (result.changes !== 1) return { success: false }
      updateServiceTimestamp(db, current.service_id)
      return { success: true }
    })()
  })

  ipcMain.handle('serviceInfo:moveFields', (_event, data: { ids: string[]; groupId: string | null }) => {
    const ids = normalizeBatchIds(data.ids)
    if (!ids) return { success: false }

    const groupId = normalizeNullableId(data.groupId)
    const updatedAt = nowIso()
    return db.transaction(() => {
      const serviceId = getFieldServiceId(db, ids)
      if (!serviceId || !fieldGroupBelongsToService(db, groupId, serviceId)) {
        return { success: false }
      }

      let sortOrder = nextFieldSortOrder(db, serviceId, groupId)
      const moveField = db.prepare(
        'UPDATE secret_fields SET group_id = ?, sort_order = ?, updated_at = ? WHERE id = ? AND service_id = ?'
      )
      for (const id of ids) {
        requireSingleChange(moveField.run(groupId, sortOrder, updatedAt, id, serviceId))
        sortOrder += 1
      }
      updateServiceTimestamp(db, serviceId)
      return { success: true }
    })()
  })

  ipcMain.handle('serviceInfo:reorderFields', (_event, data: { orderedIds: string[]; groupId: string | null }) => {
    const orderedIds = normalizeBatchIds(data.orderedIds)
    if (!orderedIds) return { success: false }

    const groupId = normalizeNullableId(data.groupId)
    const updatedAt = nowIso()
    return db.transaction(() => {
      const serviceId = getFieldServiceId(db, orderedIds)
      if (!serviceId || !fieldGroupBelongsToService(db, groupId, serviceId)) {
        return { success: false }
      }

      const reorderField = db.prepare(
        'UPDATE secret_fields SET group_id = ?, sort_order = ?, updated_at = ? WHERE id = ? AND service_id = ?'
      )
      orderedIds.forEach((id, index) => {
        requireSingleChange(reorderField.run(groupId, index + 1, updatedAt, id, serviceId))
      })
      updateServiceTimestamp(db, serviceId)
      return { success: true }
    })()
  })

  ipcMain.handle('app:openDataDirectory', async () => {
    const result = await shell.openPath(app.getPath('userData'))
    return { success: result === '' }
  })

  ipcMain.handle('app:openExternal', async (_event, value: string) => {
    try {
      const rawValue = String(value || '').trim()
      const hasUnsupportedScheme = /^[a-z][a-z0-9+.-]*:/i.test(rawValue)
        && !/^https?:/i.test(rawValue)
        && !/^localhost:\d+(?:\/|$)/i.test(rawValue)
      if (hasUnsupportedScheme) {
        return { success: false, error: '只允许打开 HTTP 或 HTTPS 地址' }
      }
      const url = new URL(/^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`)
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { success: false, error: '只允许打开 HTTP 或 HTTPS 地址' }
      }
      await shell.openExternal(url.toString())
      return { success: true }
    } catch {
      return { success: false, error: '地址格式无效' }
    }
  })

  return (nextDatabase: Database.Database) => {
    db = nextDatabase
  }
}
