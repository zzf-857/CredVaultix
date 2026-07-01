import type Database from 'better-sqlite3'

export const SERVICE_INFO_BACKUP_VERSION = 5

interface BackupData {
  secretGroups?: any[]
  secretServices?: any[]
  secretFieldGroups?: any[]
  secretFields?: any[]
}

export function readServiceInfoBackupData(db: Database.Database) {
  return {
    secretGroups: db.prepare('SELECT * FROM secret_groups').all(),
    secretServices: db.prepare('SELECT * FROM secret_services').all(),
    secretFieldGroups: db.prepare('SELECT * FROM secret_field_groups').all(),
    secretFields: db.prepare('SELECT * FROM secret_fields').all(),
  }
}

function hasServiceInfoBackupData(data: BackupData) {
  return Boolean(
    data.secretGroups ||
      data.secretServices ||
      data.secretFieldGroups ||
      data.secretFields
  )
}

export function clearServiceInfoBackupTables(db: Database.Database) {
  db.prepare('DELETE FROM secret_fields').run()
  db.prepare('DELETE FROM secret_field_groups').run()
  db.prepare('DELETE FROM secret_services').run()
  db.prepare('DELETE FROM secret_groups').run()
}

export function importServiceInfoBackupData(db: Database.Database, data: BackupData) {
  if (!hasServiceInfoBackupData(data)) {
    return
  }

  clearServiceInfoBackupTables(db)

  const now = new Date().toISOString()

  const insertSecretGroup = db.prepare('INSERT INTO secret_groups (id, name, color, sort_order, is_collapsed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  for (const group of data.secretGroups || []) {
    insertSecretGroup.run(
      group.id,
      group.name,
      group.color || '#a8c7fa',
      group.sort_order || 0,
      group.is_collapsed || 0,
      group.created_at || now,
      group.updated_at || now
    )
  }

  const insertSecretService = db.prepare(`
    INSERT INTO secret_services (id, group_id, linked_account_id, name, description, url, notes, is_favorite, is_deleted, deleted_at, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const service of data.secretServices || []) {
    insertSecretService.run(
      service.id,
      service.group_id || null,
      service.linked_account_id || null,
      service.name,
      service.description || '',
      service.url || '',
      service.notes || '',
      service.is_favorite || 0,
      service.is_deleted || 0,
      service.deleted_at || null,
      service.sort_order || 0,
      service.created_at || now,
      service.updated_at || now
    )
  }

  const insertSecretFieldGroup = db.prepare('INSERT INTO secret_field_groups (id, service_id, name, color, sort_order, is_collapsed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  for (const group of data.secretFieldGroups || []) {
    insertSecretFieldGroup.run(
      group.id,
      group.service_id,
      group.name,
      group.color || '#a8c7fa',
      group.sort_order || 0,
      group.is_collapsed || 0,
      group.created_at || now,
      group.updated_at || now
    )
  }

  const insertSecretField = db.prepare('INSERT INTO secret_fields (id, service_id, group_id, field_name, field_value, is_secret, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  for (const field of data.secretFields || []) {
    insertSecretField.run(
      field.id,
      field.service_id,
      field.group_id || null,
      field.field_name,
      field.field_value || '',
      field.is_secret ?? 1,
      field.sort_order || 0,
      field.created_at || now,
      field.updated_at || now
    )
  }
}
