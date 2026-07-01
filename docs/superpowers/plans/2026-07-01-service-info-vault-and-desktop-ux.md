# Service Info Vault and Desktop UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class custom `服务信息` vault and desktop UX upgrades while preserving all existing account data.

**Architecture:** Add service-vault data as new SQLite tables and IPC endpoints instead of overloading account custom fields. Keep migration safety in Electron main-process helpers, expose typed renderer APIs through preload, and build the UI as focused React components rather than expanding `AccountManager.tsx`.

**Tech Stack:** Electron, better-sqlite3, React 18, TypeScript, Zustand, Material UI v5, Vitest.

---

## File Structure

Create:

- `electron/databaseSafety.ts` - backup path, backup copy, core table count, and count-regression guards.
- `electron/databaseSafety.test.ts` - node-side Vitest coverage for backup and count helpers.
- `electron/serviceInfoRepository.ts` - SQLite repository and IPC registration for service groups, services, field groups, and fields.
- `src/utils/serviceInfoGrouping.ts` - pure grouping, ungrouping, reorder, and sort helpers for renderer tests and components.
- `src/utils/serviceInfoGrouping.test.ts` - Vitest coverage for service and field grouping behavior.
- `src/components/service-info/ServiceInfoManager.tsx` - feature shell for the service information module.
- `src/components/service-info/ServiceGroupList.tsx` - outer group and ungrouped service list.
- `src/components/service-info/ServiceListItem.tsx` - service row/card with selection and drag handle.
- `src/components/service-info/ServiceDetail.tsx` - selected service detail panel.
- `src/components/service-info/ServiceFieldGroup.tsx` - inner field group block.
- `src/components/service-info/ServiceFieldRow.tsx` - field row with reveal, copy, edit, delete, selection, and drag affordances.
- `src/components/service-info/BatchActionBar.tsx` - shared batch action surface for selected services or fields.
- `src/components/common/ResizableSidebar.tsx` - shell sidebar resize and collapse helper.

Modify:

- `electron/database.ts` - run service-info schema migration behind database backup and count verification.
- `electron/main.ts` - register service-info IPC, preference/data-directory IPC, and include new export/import arrays.
- `electron/preload.ts` - expose typed service-info and preference APIs.
- `src/types.ts` - add service-info rows, filters, sort modes, payloads, and Electron API signatures.
- `src/stores/useStore.ts` - add service-info state/actions and preference-backed UI state.
- `src/App.tsx` - route `activeView === 'service-info'` to the new module and use shared sidebar behavior.
- `src/components/Sidebar.tsx` - add `服务信息`, collapse-aware rendering, and data directory action.
- `src/theme/index.ts` - reduce overly decorative defaults where the shared shell is affected.
- `README.md` - document the new local service information area and data backup posture.

Do not stage these existing untracked workspace files unless the user explicitly asks:

- `AccountManager_backup_2026-07-01.json`
- `diff.txt`
- `diff_am.txt`
- `diff_utf8.txt`

## Task 1: Database Backup Safety

**Files:**
- Create: `electron/databaseSafety.ts`
- Create: `electron/databaseSafety.test.ts`

- [ ] **Step 1: Write the failing backup helper tests**

Create `electron/databaseSafety.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import {
  assertCountsNotReduced,
  backupDatabaseIfExists,
  buildDatabaseBackupPath,
  getExistingTableCounts,
} from './databaseSafety'

describe('databaseSafety', () => {
  it('builds a timestamped backup path inside the user data folder', () => {
    const path = buildDatabaseBackupPath('C:/AppData/CredVaultix', new Date('2026-07-01T10:11:12.000Z'))
    expect(path.replace(/\\/g, '/')).toBe(
      'C:/AppData/CredVaultix/account-manager-before-service-vault-2026-07-01-101112.db'
    )
  })

  it('copies an existing database before migration', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-backup-'))
    try {
      const dbPath = join(dir, 'account-manager.db')
      writeFileSync(dbPath, 'current-data')

      const result = backupDatabaseIfExists(dbPath, dir, new Date('2026-07-01T10:11:12.000Z'))

      expect(result.created).toBe(true)
      expect(result.filePath?.endsWith('account-manager-before-service-vault-2026-07-01-101112.db')).toBe(true)
      expect(readFileSync(result.filePath!, 'utf-8')).toBe('current-data')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('skips backup when the database does not exist yet', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-backup-missing-'))
    try {
      const result = backupDatabaseIfExists(join(dir, 'missing.db'), dir)
      expect(result.created).toBe(false)
      expect(result.filePath).toBeUndefined()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('counts only existing core tables', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-counts-'))
    const dbPath = join(dir, 'test.db')
    const db = new Database(dbPath)
    try {
      db.exec(`
        CREATE TABLE accounts (id TEXT PRIMARY KEY);
        CREATE TABLE tags (id TEXT PRIMARY KEY);
        INSERT INTO accounts (id) VALUES ('a1'), ('a2');
        INSERT INTO tags (id) VALUES ('t1');
      `)

      expect(getExistingTableCounts(db, ['accounts', 'totp_accounts', 'tags'])).toEqual({
        accounts: 2,
        tags: 1,
      })
    } finally {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('throws when a protected table count is reduced', () => {
    expect(() =>
      assertCountsNotReduced({ accounts: 2, tags: 1 }, { accounts: 1, tags: 1 })
    ).toThrow('Migration reduced protected table accounts from 2 to 1')
  })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npm test -- electron/databaseSafety.test.ts
```

Expected: FAIL because `electron/databaseSafety.ts` does not exist.

- [ ] **Step 3: Implement the backup helper**

Create `electron/databaseSafety.ts`:

```ts
import fs from 'fs'
import path from 'path'
import type Database from 'better-sqlite3'

export const PROTECTED_TABLES = [
  'accounts',
  'totp_accounts',
  'tags',
  'account_custom_fields',
  'account_tags',
] as const

export type CoreTableCounts = Record<string, number>

export interface BackupResult {
  created: boolean
  filePath?: string
}

function formatBackupTimestamp(now: Date) {
  return now.toISOString().replace(/\.\d{3}Z$/, '').replace(/[-:T]/g, '-').replace(/-(\d{2})-(\d{2})$/, '-$1$2')
}

export function buildDatabaseBackupPath(userDataPath: string, now = new Date()) {
  const timestamp = formatBackupTimestamp(now)
  return path.join(userDataPath, `account-manager-before-service-vault-${timestamp}.db`)
}

export function backupDatabaseIfExists(dbPath: string, userDataPath: string, now = new Date()): BackupResult {
  if (!fs.existsSync(dbPath)) {
    return { created: false }
  }

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }

  const backupPath = buildDatabaseBackupPath(userDataPath, now)
  fs.copyFileSync(dbPath, backupPath)

  const sourceSize = fs.statSync(dbPath).size
  const backupSize = fs.statSync(backupPath).size
  if (sourceSize !== backupSize) {
    throw new Error(`Database backup size mismatch: ${sourceSize} !== ${backupSize}`)
  }

  return { created: true, filePath: backupPath }
}

export function hasTable(db: Database.Database, tableName: string) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name?: string } | undefined
  return Boolean(row?.name)
}

export function getExistingTableCounts(
  db: Database.Database,
  tableNames: readonly string[] = PROTECTED_TABLES
): CoreTableCounts {
  const counts: CoreTableCounts = {}

  for (const tableName of tableNames) {
    if (hasTable(db, tableName)) {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number }
      counts[tableName] = row.count
    }
  }

  return counts
}

export function assertCountsNotReduced(before: CoreTableCounts, after: CoreTableCounts) {
  for (const [tableName, beforeCount] of Object.entries(before)) {
    const afterCount = after[tableName]
    if (afterCount === undefined) {
      throw new Error(`Migration removed protected table ${tableName}`)
    }
    if (afterCount < beforeCount) {
      throw new Error(`Migration reduced protected table ${tableName} from ${beforeCount} to ${afterCount}`)
    }
  }
}
```

- [ ] **Step 4: Run the backup helper test**

Run:

```powershell
npm test -- electron/databaseSafety.test.ts
```

Expected: PASS for all `databaseSafety` tests.

- [ ] **Step 5: Commit**

Run:

```powershell
git add -- electron/databaseSafety.ts electron/databaseSafety.test.ts
git commit -m "chore: 新增数据库升级前自动备份"
```

## Task 2: Service Information Schema Migration

**Files:**
- Modify: `electron/database.ts`
- Modify: `electron/databaseSafety.ts`
- Modify: `electron/databaseSafety.test.ts`

- [ ] **Step 1: Add failing schema readiness tests**

Append to `electron/databaseSafety.test.ts`:

```ts
import { hasServiceInfoSchema } from './databaseSafety'

describe('service info schema readiness', () => {
  it('returns false when service information tables are missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-schema-missing-'))
    const db = new Database(join(dir, 'test.db'))
    try {
      db.exec('CREATE TABLE accounts (id TEXT PRIMARY KEY);')
      expect(hasServiceInfoSchema(db)).toBe(false)
    } finally {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns true when all service information tables exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-schema-ready-'))
    const db = new Database(join(dir, 'test.db'))
    try {
      db.exec(`
        CREATE TABLE secret_groups (id TEXT PRIMARY KEY);
        CREATE TABLE secret_services (id TEXT PRIMARY KEY);
        CREATE TABLE secret_field_groups (id TEXT PRIMARY KEY);
        CREATE TABLE secret_fields (id TEXT PRIMARY KEY);
      `)
      expect(hasServiceInfoSchema(db)).toBe(true)
    } finally {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
```

- [ ] **Step 2: Run the failing schema test**

Run:

```powershell
npm test -- electron/databaseSafety.test.ts
```

Expected: FAIL because `hasServiceInfoSchema` is not exported.

- [ ] **Step 3: Add schema readiness helper**

Update `electron/databaseSafety.ts`:

```ts
export const SERVICE_INFO_TABLES = [
  'secret_groups',
  'secret_services',
  'secret_field_groups',
  'secret_fields',
] as const

export function hasServiceInfoSchema(db: Database.Database) {
  return SERVICE_INFO_TABLES.every((tableName) => hasTable(db, tableName))
}
```

- [ ] **Step 4: Add the service-info schema to database initialization**

Modify `electron/database.ts`:

```ts
import {
  assertCountsNotReduced,
  backupDatabaseIfExists,
  getExistingTableCounts,
  hasServiceInfoSchema,
} from './databaseSafety'
```

Inside `initDatabase()`, after computing `dbPath`, open a temporary connection to decide whether a service-info migration is needed:

```ts
const userDataPath = app.getPath('userData')
const dbPath = path.join(userDataPath, 'account-manager.db')
let needsServiceInfoMigration = false

if (fs.existsSync(dbPath)) {
  const schemaCheckDb = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    needsServiceInfoMigration = !hasServiceInfoSchema(schemaCheckDb)
  } finally {
    schemaCheckDb.close()
  }
}

if (needsServiceInfoMigration) {
  backupDatabaseIfExists(dbPath, userDataPath)
}

db = new Database(dbPath)
```

Before the schema `db.exec`, record counts:

```ts
const protectedCountsBefore = getExistingTableCounts(db)
```

Add the new schema inside the existing `db.exec` block:

```sql
CREATE TABLE IF NOT EXISTS secret_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#a8c7fa',
  sort_order INTEGER DEFAULT 0,
  is_collapsed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS secret_services (
  id TEXT PRIMARY KEY,
  group_id TEXT DEFAULT NULL REFERENCES secret_groups(id) ON DELETE SET NULL,
  linked_account_id TEXT DEFAULT NULL REFERENCES accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_favorite INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  deleted_at DATETIME DEFAULT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS secret_field_groups (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES secret_services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#a8c7fa',
  sort_order INTEGER DEFAULT 0,
  is_collapsed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS secret_fields (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES secret_services(id) ON DELETE CASCADE,
  group_id TEXT DEFAULT NULL REFERENCES secret_field_groups(id) ON DELETE SET NULL,
  field_name TEXT NOT NULL,
  field_value TEXT DEFAULT '',
  is_secret INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_secret_services_group ON secret_services(group_id);
CREATE INDEX IF NOT EXISTS idx_secret_services_deleted ON secret_services(is_deleted);
CREATE INDEX IF NOT EXISTS idx_secret_field_groups_service ON secret_field_groups(service_id);
CREATE INDEX IF NOT EXISTS idx_secret_fields_service ON secret_fields(service_id);
CREATE INDEX IF NOT EXISTS idx_secret_fields_group ON secret_fields(group_id);
```

After all existing migration statements finish, verify counts:

```ts
const protectedCountsAfter = getExistingTableCounts(db)
assertCountsNotReduced(protectedCountsBefore, protectedCountsAfter)
```

- [ ] **Step 5: Run schema tests and typecheck**

Run:

```powershell
npm test -- electron/databaseSafety.test.ts
npm run typecheck
```

Expected: both commands pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- electron/database.ts electron/databaseSafety.ts electron/databaseSafety.test.ts
git commit -m "feat: 新增服务信息数据表迁移"
```

## Task 3: Service Information Types and Preload Contract

**Files:**
- Modify: `src/types.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: Add renderer and Electron API types**

Update `src/types.ts` with:

```ts
export type ServiceInfoSortMode =
  | 'manual'
  | 'name-asc'
  | 'name-desc'
  | 'updated-desc'
  | 'updated-asc'
  | 'favorites-first'
  | 'random'

export interface SecretGroupRow {
  id: string
  name: string
  color: string
  sort_order: number
  is_collapsed: number
  created_at: string
  updated_at: string
}

export interface SecretServiceRow {
  id: string
  group_id: string | null
  linked_account_id: string | null
  name: string
  description: string
  url: string
  notes: string
  is_favorite: number
  is_deleted: number
  deleted_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SecretFieldGroupRow {
  id: string
  service_id: string
  name: string
  color: string
  sort_order: number
  is_collapsed: number
  created_at: string
  updated_at: string
}

export interface SecretFieldRow {
  id: string
  service_id: string
  group_id: string | null
  field_name: string
  field_value: string
  is_secret: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ServiceInfoPayload {
  groups: SecretGroupRow[]
  services: SecretServiceRow[]
}

export interface ServiceDetailPayload {
  service: SecretServiceRow
  fieldGroups: SecretFieldGroupRow[]
  fields: SecretFieldRow[]
}

export interface CreateSecretServiceData {
  id: string
  name: string
  groupId?: string | null
  description?: string
  url?: string
  notes?: string
  linkedAccountId?: string | null
}

export interface UpdateSecretServiceData {
  groupId?: string | null
  linkedAccountId?: string | null
  name?: string
  description?: string
  url?: string
  notes?: string
  isFavorite?: number
}

export interface CreateSecretFieldData {
  id: string
  serviceId: string
  groupId?: string | null
  fieldName: string
  fieldValue?: string
  isSecret?: boolean
}

export interface UpdateSecretFieldData {
  groupId?: string | null
  fieldName?: string
  fieldValue?: string
  isSecret?: boolean
}
```

Extend `ElectronAPI`:

```ts
getServiceInfo: () => Promise<ServiceInfoPayload>
getServiceDetail: (serviceId: string) => Promise<ServiceDetailPayload | null>
createSecretGroup: (data: { id: string; name: string; color?: string }) => Promise<{ id: string }>
updateSecretGroup: (id: string, data: { name?: string; color?: string; isCollapsed?: number; sortOrder?: number }) => Promise<{ success: boolean }>
deleteSecretGroup: (id: string) => Promise<{ success: boolean }>
createSecretService: (data: CreateSecretServiceData) => Promise<{ id: string }>
updateSecretService: (id: string, data: UpdateSecretServiceData) => Promise<{ success: boolean }>
deleteSecretService: (id: string) => Promise<{ success: boolean }>
moveSecretServices: (data: { ids: string[]; groupId: string | null }) => Promise<{ success: boolean }>
reorderSecretServices: (data: { orderedIds: string[]; groupId: string | null }) => Promise<{ success: boolean }>
createSecretFieldGroup: (data: { id: string; serviceId: string; name: string; color?: string }) => Promise<{ id: string }>
updateSecretFieldGroup: (id: string, data: { name?: string; color?: string; isCollapsed?: number; sortOrder?: number }) => Promise<{ success: boolean }>
deleteSecretFieldGroup: (id: string) => Promise<{ success: boolean }>
createSecretField: (data: CreateSecretFieldData) => Promise<{ id: string }>
updateSecretField: (id: string, data: UpdateSecretFieldData) => Promise<{ success: boolean }>
deleteSecretField: (id: string) => Promise<{ success: boolean }>
moveSecretFields: (data: { ids: string[]; groupId: string | null }) => Promise<{ success: boolean }>
reorderSecretFields: (data: { orderedIds: string[]; groupId: string | null }) => Promise<{ success: boolean }>
openDataDirectory: () => Promise<{ success: boolean }>
```

- [ ] **Step 2: Expose preload methods**

Update `electron/preload.ts`:

```ts
getServiceInfo: () => ipcRenderer.invoke('serviceInfo:getAll'),
getServiceDetail: (serviceId: string) => ipcRenderer.invoke('serviceInfo:getDetail', serviceId),
createSecretGroup: (data: any) => ipcRenderer.invoke('serviceInfo:createGroup', data),
updateSecretGroup: (id: string, data: any) => ipcRenderer.invoke('serviceInfo:updateGroup', id, data),
deleteSecretGroup: (id: string) => ipcRenderer.invoke('serviceInfo:deleteGroup', id),
createSecretService: (data: any) => ipcRenderer.invoke('serviceInfo:createService', data),
updateSecretService: (id: string, data: any) => ipcRenderer.invoke('serviceInfo:updateService', id, data),
deleteSecretService: (id: string) => ipcRenderer.invoke('serviceInfo:deleteService', id),
moveSecretServices: (data: any) => ipcRenderer.invoke('serviceInfo:moveServices', data),
reorderSecretServices: (data: any) => ipcRenderer.invoke('serviceInfo:reorderServices', data),
createSecretFieldGroup: (data: any) => ipcRenderer.invoke('serviceInfo:createFieldGroup', data),
updateSecretFieldGroup: (id: string, data: any) => ipcRenderer.invoke('serviceInfo:updateFieldGroup', id, data),
deleteSecretFieldGroup: (id: string) => ipcRenderer.invoke('serviceInfo:deleteFieldGroup', id),
createSecretField: (data: any) => ipcRenderer.invoke('serviceInfo:createField', data),
updateSecretField: (id: string, data: any) => ipcRenderer.invoke('serviceInfo:updateField', id, data),
deleteSecretField: (id: string) => ipcRenderer.invoke('serviceInfo:deleteField', id),
moveSecretFields: (data: any) => ipcRenderer.invoke('serviceInfo:moveFields', data),
reorderSecretFields: (data: any) => ipcRenderer.invoke('serviceInfo:reorderFields', data),
openDataDirectory: () => ipcRenderer.invoke('app:openDataDirectory'),
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS because these are type and preload additions only.

- [ ] **Step 4: Commit**

Run:

```powershell
git add -- src/types.ts electron/preload.ts
git commit -m "feat: 增加服务信息类型和预加载接口"
```

## Task 4: Service Information IPC Repository

**Files:**
- Create: `electron/serviceInfoRepository.ts`
- Modify: `electron/main.ts`
- Modify: `electron/serviceInfoRepository.ts`

- [ ] **Step 1: Create the repository and IPC registrar**

Create `electron/serviceInfoRepository.ts`:

```ts
import { BrowserWindow, ipcMain, shell, app } from 'electron'
import type Database from 'better-sqlite3'
import { encrypt, decrypt } from './crypto'

function normalizeNullableId(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function requireName(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required`)
  }
  return value.trim()
}

function nextSortOrder(db: Database.Database, table: string, where: string, value: string | null) {
  const sql = value === null
    ? `SELECT MAX(sort_order) as maxOrder FROM ${table} WHERE ${where} IS NULL`
    : `SELECT MAX(sort_order) as maxOrder FROM ${table} WHERE ${where} = ?`
  const row = value === null
    ? db.prepare(sql).get() as { maxOrder: number | null }
    : db.prepare(sql).get(value) as { maxOrder: number | null }
  return (row?.maxOrder || 0) + 1
}

export function registerServiceInfoIpc(db: Database.Database, mainWindowRef: () => BrowserWindow | null) {
  ipcMain.handle('serviceInfo:getAll', () => {
    return {
      groups: db.prepare('SELECT * FROM secret_groups ORDER BY sort_order ASC, name ASC').all(),
      services: db.prepare('SELECT * FROM secret_services WHERE is_deleted = 0 ORDER BY sort_order ASC, updated_at DESC').all(),
    }
  })

  ipcMain.handle('serviceInfo:getDetail', (_event, serviceId: string) => {
    const service = db.prepare('SELECT * FROM secret_services WHERE id = ? AND is_deleted = 0').get(serviceId)
    if (!service) return null
    const fieldGroups = db.prepare('SELECT * FROM secret_field_groups WHERE service_id = ? ORDER BY sort_order ASC, name ASC').all(serviceId)
    const fields = (db.prepare('SELECT * FROM secret_fields WHERE service_id = ? ORDER BY sort_order ASC, field_name ASC').all(serviceId) as any[])
      .map((field) => ({
        ...field,
        field_value: field.is_secret ? decrypt(field.field_value) : field.field_value,
      }))
    return { service, fieldGroups, fields }
  })

  ipcMain.handle('serviceInfo:createGroup', (_event, data: { id: string; name: string; color?: string }) => {
    const name = requireName(data.name, 'Group name')
    const sortOrder = nextSortOrder(db, 'secret_groups', 'id', null)
    db.prepare('INSERT INTO secret_groups (id, name, color, sort_order) VALUES (?, ?, ?, ?)').run(
      data.id,
      name,
      data.color || '#a8c7fa',
      sortOrder
    )
    return { id: data.id }
  })

  ipcMain.handle('serviceInfo:updateGroup', (_event, id: string, data: { name?: string; color?: string; isCollapsed?: number; sortOrder?: number }) => {
    const updates: string[] = ['updated_at = ?']
    const params: any[] = [new Date().toISOString()]
    if (data.name !== undefined) { updates.push('name = ?'); params.push(requireName(data.name, 'Group name')) }
    if (data.color !== undefined) { updates.push('color = ?'); params.push(data.color || '#a8c7fa') }
    if (data.isCollapsed !== undefined) { updates.push('is_collapsed = ?'); params.push(data.isCollapsed ? 1 : 0) }
    if (data.sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(data.sortOrder) }
    params.push(id)
    db.prepare(`UPDATE secret_groups SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    return { success: true }
  })

  ipcMain.handle('serviceInfo:deleteGroup', (_event, id: string) => {
    db.transaction(() => {
      db.prepare('UPDATE secret_services SET group_id = NULL, updated_at = ? WHERE group_id = ?').run(new Date().toISOString(), id)
      db.prepare('DELETE FROM secret_groups WHERE id = ?').run(id)
    })()
    return { success: true }
  })

  ipcMain.handle('serviceInfo:createService', (_event, data: any) => {
    const now = new Date().toISOString()
    const groupId = normalizeNullableId(data.groupId)
    const sortOrder = nextSortOrder(db, 'secret_services', 'group_id', groupId)
    db.prepare(`
      INSERT INTO secret_services (id, group_id, linked_account_id, name, description, url, notes, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      groupId,
      normalizeNullableId(data.linkedAccountId),
      requireName(data.name, 'Service name'),
      data.description || '',
      data.url || '',
      data.notes || '',
      sortOrder,
      now,
      now
    )
    return { id: data.id }
  })

  ipcMain.handle('serviceInfo:updateService', (_event, id: string, data: any) => {
    const updates: string[] = ['updated_at = ?']
    const params: any[] = [new Date().toISOString()]
    if (data.groupId !== undefined) { updates.push('group_id = ?'); params.push(normalizeNullableId(data.groupId)) }
    if (data.linkedAccountId !== undefined) { updates.push('linked_account_id = ?'); params.push(normalizeNullableId(data.linkedAccountId)) }
    if (data.name !== undefined) { updates.push('name = ?'); params.push(requireName(data.name, 'Service name')) }
    if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description) }
    if (data.url !== undefined) { updates.push('url = ?'); params.push(data.url) }
    if (data.notes !== undefined) { updates.push('notes = ?'); params.push(data.notes) }
    if (data.isFavorite !== undefined) { updates.push('is_favorite = ?'); params.push(data.isFavorite ? 1 : 0) }
    params.push(id)
    db.prepare(`UPDATE secret_services SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    return { success: true }
  })

  ipcMain.handle('serviceInfo:deleteService', (_event, id: string) => {
    db.prepare('UPDATE secret_services SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), new Date().toISOString(), id)
    return { success: true }
  })

  ipcMain.handle('serviceInfo:moveServices', (_event, data: { ids: string[]; groupId: string | null }) => {
    const groupId = normalizeNullableId(data.groupId)
    db.transaction(() => {
      for (const id of data.ids) {
        db.prepare('UPDATE secret_services SET group_id = ?, updated_at = ? WHERE id = ?').run(groupId, new Date().toISOString(), id)
      }
    })()
    return { success: true }
  })

  ipcMain.handle('serviceInfo:reorderServices', (_event, data: { orderedIds: string[]; groupId: string | null }) => {
    db.transaction(() => {
      data.orderedIds.forEach((id, index) => {
        db.prepare('UPDATE secret_services SET group_id = ?, sort_order = ?, updated_at = ? WHERE id = ?')
          .run(normalizeNullableId(data.groupId), index + 1, new Date().toISOString(), id)
      })
    })()
    return { success: true }
  })

  ipcMain.handle('serviceInfo:createFieldGroup', (_event, data: { id: string; serviceId: string; name: string; color?: string }) => {
    const sortOrder = nextSortOrder(db, 'secret_field_groups', 'service_id', data.serviceId)
    db.prepare('INSERT INTO secret_field_groups (id, service_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)')
      .run(data.id, data.serviceId, requireName(data.name, 'Field group name'), data.color || '#a8c7fa', sortOrder)
    return { id: data.id }
  })

  ipcMain.handle('serviceInfo:updateFieldGroup', (_event, id: string, data: any) => {
    const updates: string[] = ['updated_at = ?']
    const params: any[] = [new Date().toISOString()]
    if (data.name !== undefined) { updates.push('name = ?'); params.push(requireName(data.name, 'Field group name')) }
    if (data.color !== undefined) { updates.push('color = ?'); params.push(data.color || '#a8c7fa') }
    if (data.isCollapsed !== undefined) { updates.push('is_collapsed = ?'); params.push(data.isCollapsed ? 1 : 0) }
    if (data.sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(data.sortOrder) }
    params.push(id)
    db.prepare(`UPDATE secret_field_groups SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    return { success: true }
  })

  ipcMain.handle('serviceInfo:deleteFieldGroup', (_event, id: string) => {
    db.transaction(() => {
      db.prepare('UPDATE secret_fields SET group_id = NULL, updated_at = ? WHERE group_id = ?').run(new Date().toISOString(), id)
      db.prepare('DELETE FROM secret_field_groups WHERE id = ?').run(id)
    })()
    return { success: true }
  })

  ipcMain.handle('serviceInfo:createField', (_event, data: any) => {
    const isSecret = data.isSecret !== false
    const groupId = normalizeNullableId(data.groupId)
    const sortOrder = nextSortOrder(db, 'secret_fields', 'group_id', groupId)
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
      sortOrder
    )
    return { id: data.id }
  })

  ipcMain.handle('serviceInfo:updateField', (_event, id: string, data: any) => {
    const current = db.prepare('SELECT is_secret FROM secret_fields WHERE id = ?').get(id) as { is_secret: number } | undefined
    const nextSecret = data.isSecret !== undefined ? Boolean(data.isSecret) : Boolean(current?.is_secret)
    const updates: string[] = ['updated_at = ?']
    const params: any[] = [new Date().toISOString()]
    if (data.groupId !== undefined) { updates.push('group_id = ?'); params.push(normalizeNullableId(data.groupId)) }
    if (data.fieldName !== undefined) { updates.push('field_name = ?'); params.push(requireName(data.fieldName, 'Field name')) }
    if (data.fieldValue !== undefined) { updates.push('field_value = ?'); params.push(nextSecret ? encrypt(data.fieldValue) : data.fieldValue) }
    if (data.isSecret !== undefined) { updates.push('is_secret = ?'); params.push(nextSecret ? 1 : 0) }
    params.push(id)
    db.prepare(`UPDATE secret_fields SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    return { success: true }
  })

  ipcMain.handle('serviceInfo:deleteField', (_event, id: string) => {
    db.prepare('DELETE FROM secret_fields WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('serviceInfo:moveFields', (_event, data: { ids: string[]; groupId: string | null }) => {
    db.transaction(() => {
      for (const id of data.ids) {
        db.prepare('UPDATE secret_fields SET group_id = ?, updated_at = ? WHERE id = ?').run(normalizeNullableId(data.groupId), new Date().toISOString(), id)
      }
    })()
    return { success: true }
  })

  ipcMain.handle('serviceInfo:reorderFields', (_event, data: { orderedIds: string[]; groupId: string | null }) => {
    db.transaction(() => {
      data.orderedIds.forEach((id, index) => {
        db.prepare('UPDATE secret_fields SET group_id = ?, sort_order = ?, updated_at = ? WHERE id = ?')
          .run(normalizeNullableId(data.groupId), index + 1, new Date().toISOString(), id)
      })
    })()
    return { success: true }
  })

  ipcMain.handle('app:openDataDirectory', async () => {
    const result = await shell.openPath(app.getPath('userData'))
    return { success: result === '' }
  })
}
```

- [ ] **Step 2: Register the repository from the main process**

Update `electron/main.ts`:

```ts
import { registerServiceInfoIpc } from './serviceInfoRepository'
```

Inside `registerIpcHandlers()` after `let db = getDatabase()`:

```ts
registerServiceInfoIpc(db, () => mainWindow)
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```powershell
git add -- electron/serviceInfoRepository.ts electron/main.ts
git commit -m "feat: 增加服务信息后端接口"
```

## Task 5: Grouping Helpers and Store Slice

**Files:**
- Create: `src/utils/serviceInfoGrouping.ts`
- Create: `src/utils/serviceInfoGrouping.test.ts`
- Modify: `src/stores/useStore.ts`

- [ ] **Step 1: Write failing grouping helper tests**

Create `src/utils/serviceInfoGrouping.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  getGroupedItems,
  moveItemsToGroup,
  reorderItems,
  sortServiceInfoItems,
} from './serviceInfoGrouping'

interface Item {
  id: string
  group_id: string | null
  name: string
  sort_order: number
  updated_at: string
  is_favorite?: number
}

describe('serviceInfoGrouping', () => {
  const items: Item[] = [
    { id: 'a', group_id: null, name: 'Alpha', sort_order: 2, updated_at: '2026-07-01T01:00:00.000Z' },
    { id: 'b', group_id: 'g1', name: 'Beta', sort_order: 1, updated_at: '2026-07-01T02:00:00.000Z', is_favorite: 1 },
    { id: 'c', group_id: 'g1', name: 'Gamma', sort_order: 2, updated_at: '2026-07-01T03:00:00.000Z' },
  ]

  it('groups items by nullable group id', () => {
    expect(getGroupedItems(items)).toEqual({
      ungrouped: [items[0]],
      groups: {
        g1: [items[1], items[2]],
      },
    })
  })

  it('moves selected items into a group without dropping other items', () => {
    expect(moveItemsToGroup(items, ['a', 'c'], 'g2').map((item) => [item.id, item.group_id])).toEqual([
      ['a', 'g2'],
      ['b', 'g1'],
      ['c', 'g2'],
    ])
  })

  it('moves selected items out to ungrouped', () => {
    expect(moveItemsToGroup(items, ['b'], null).find((item) => item.id === 'b')?.group_id).toBeNull()
  })

  it('reorders only the supplied ids', () => {
    expect(reorderItems(items, ['c', 'b']).map((item) => [item.id, item.sort_order])).toEqual([
      ['a', 2],
      ['b', 2],
      ['c', 1],
    ])
  })

  it('sorts services by favorite first', () => {
    expect(sortServiceInfoItems(items, 'favorites-first').map((item) => item.id)).toEqual(['b', 'a', 'c'])
  })
})
```

- [ ] **Step 2: Run the failing grouping tests**

Run:

```powershell
npm test -- src/utils/serviceInfoGrouping.test.ts
```

Expected: FAIL because `src/utils/serviceInfoGrouping.ts` does not exist.

- [ ] **Step 3: Implement grouping helpers**

Create `src/utils/serviceInfoGrouping.ts`:

```ts
import type { ServiceInfoSortMode } from '../types'

export interface GroupableItem {
  id: string
  group_id: string | null
  name?: string
  field_name?: string
  sort_order: number
  updated_at?: string
  is_favorite?: number
}

export function getGroupedItems<T extends GroupableItem>(items: T[]) {
  const groups: Record<string, T[]> = {}
  const ungrouped: T[] = []

  for (const item of items) {
    if (item.group_id) {
      groups[item.group_id] = groups[item.group_id] || []
      groups[item.group_id].push(item)
    } else {
      ungrouped.push(item)
    }
  }

  return { ungrouped, groups }
}

export function moveItemsToGroup<T extends GroupableItem>(items: T[], ids: string[], groupId: string | null): T[] {
  const selected = new Set(ids)
  return items.map((item) => selected.has(item.id) ? { ...item, group_id: groupId } : item)
}

export function reorderItems<T extends GroupableItem>(items: T[], orderedIds: string[]): T[] {
  const order = new Map(orderedIds.map((id, index) => [id, index + 1]))
  return items.map((item) => order.has(item.id) ? { ...item, sort_order: order.get(item.id)! } : item)
}

function labelOf(item: GroupableItem) {
  return item.name || item.field_name || ''
}

export function sortServiceInfoItems<T extends GroupableItem>(items: T[], mode: ServiceInfoSortMode): T[] {
  const sorted = [...items]
  switch (mode) {
    case 'name-asc':
      return sorted.sort((a, b) => labelOf(a).localeCompare(labelOf(b), 'zh-Hans-CN'))
    case 'name-desc':
      return sorted.sort((a, b) => labelOf(b).localeCompare(labelOf(a), 'zh-Hans-CN'))
    case 'updated-desc':
      return sorted.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    case 'updated-asc':
      return sorted.sort((a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''))
    case 'favorites-first':
      return sorted.sort((a, b) => (b.is_favorite || 0) - (a.is_favorite || 0) || a.sort_order - b.sort_order)
    case 'random':
      return sorted.sort((a, b) => a.id.localeCompare(b.id)).sort(() => Math.random() - 0.5)
    case 'manual':
    default:
      return sorted.sort((a, b) => a.sort_order - b.sort_order || labelOf(a).localeCompare(labelOf(b), 'zh-Hans-CN'))
  }
}
```

- [ ] **Step 4: Add the Zustand service-info slice**

Update imports in `src/stores/useStore.ts`:

```ts
import {
  SecretFieldGroupRow,
  SecretFieldRow,
  SecretGroupRow,
  SecretServiceRow,
  ServiceInfoSortMode,
} from '../types'
```

Extend `AppState`:

```ts
serviceGroups: SecretGroupRow[]
secretServices: SecretServiceRow[]
selectedServiceId: string | null
selectedServiceDetail: {
  service: SecretServiceRow
  fieldGroups: SecretFieldGroupRow[]
  fields: SecretFieldRow[]
} | null
serviceSearchQuery: string
serviceSortMode: ServiceInfoSortMode
selectedServiceIds: string[]
selectedFieldIds: string[]
loadServiceInfo: () => Promise<void>
loadServiceDetail: (serviceId: string) => Promise<void>
setSelectedService: (id: string | null) => void
setServiceSearchQuery: (query: string) => void
setServiceSortMode: (mode: ServiceInfoSortMode) => void
toggleSelectedServiceId: (id: string) => void
clearSelectedServiceIds: () => void
toggleSelectedFieldId: (id: string) => void
clearSelectedFieldIds: () => void
```

Add initial state and actions:

```ts
serviceGroups: [],
secretServices: [],
selectedServiceId: null,
selectedServiceDetail: null,
serviceSearchQuery: '',
serviceSortMode: 'manual',
selectedServiceIds: [],
selectedFieldIds: [],

loadServiceInfo: async () => {
  const payload = await window.electronAPI.getServiceInfo()
  set({ serviceGroups: payload.groups, secretServices: payload.services })
},
loadServiceDetail: async (serviceId) => {
  const payload = await window.electronAPI.getServiceDetail(serviceId)
  set({ selectedServiceDetail: payload })
},
setSelectedService: (id) => {
  set({ selectedServiceId: id, selectedFieldIds: [] })
  if (id) void get().loadServiceDetail(id)
},
setServiceSearchQuery: (serviceSearchQuery) => set({ serviceSearchQuery }),
setServiceSortMode: (serviceSortMode) => set({ serviceSortMode }),
toggleSelectedServiceId: (id) => set((state) => ({
  selectedServiceIds: state.selectedServiceIds.includes(id)
    ? state.selectedServiceIds.filter((item) => item !== id)
    : [...state.selectedServiceIds, id],
})),
clearSelectedServiceIds: () => set({ selectedServiceIds: [] }),
toggleSelectedFieldId: (id) => set((state) => ({
  selectedFieldIds: state.selectedFieldIds.includes(id)
    ? state.selectedFieldIds.filter((item) => item !== id)
    : [...state.selectedFieldIds, id],
})),
clearSelectedFieldIds: () => set({ selectedFieldIds: [] }),
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```powershell
npm test -- src/utils/serviceInfoGrouping.test.ts
npm run typecheck
```

Expected: both commands pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- src/utils/serviceInfoGrouping.ts src/utils/serviceInfoGrouping.test.ts src/stores/useStore.ts
git commit -m "feat: 增加服务信息状态管理"
```

## Task 6: Service Information Navigation and List UI

**Files:**
- Create: `src/components/service-info/BatchActionBar.tsx`
- Create: `src/components/service-info/ServiceInfoManager.tsx`
- Create: `src/components/service-info/ServiceGroupList.tsx`
- Create: `src/components/service-info/ServiceListItem.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/stores/useStore.ts`

- [ ] **Step 1: Extend the active view union**

In `src/stores/useStore.ts`, change every active view union from:

```ts
'accounts' | '2fa' | 'trash'
```

to:

```ts
'accounts' | 'service-info' | '2fa' | 'trash'
```

- [ ] **Step 2: Add sidebar navigation**

Update `src/components/Sidebar.tsx` imports:

```ts
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
```

Add a `ListItemButton` between accounts and 2FA:

```tsx
<ListItemButton
  selected={activeView === 'service-info'}
  onClick={() => setActiveView('service-info')}
  sx={{ borderRadius: 2, mb: 0.5 }}
>
  <ListItemIcon sx={{ minWidth: 36 }}>
    <VpnKeyOutlinedIcon sx={{ fontSize: 20, color: '#fdd663' }} />
  </ListItemIcon>
  <ListItemText
    primary="服务信息"
    secondary="自定义密钥、服务器与资料"
    primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }}
    secondaryTypographyProps={{ fontSize: '0.74rem' }}
  />
</ListItemButton>
```

- [ ] **Step 3: Create shared batch action bar**

Create `src/components/service-info/BatchActionBar.tsx`:

```tsx
import React from 'react'
import { Box, Button, Typography } from '@mui/material'

export default function BatchActionBar({
  count,
  onClear,
  onCreateGroup,
  onMoveToGroup,
  onUngroup,
}: {
  count: number
  onClear: () => void
  onCreateGroup: () => void
  onMoveToGroup: () => void
  onUngroup: () => void
}) {
  if (count <= 0) return null

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2" sx={{ flex: 1, color: 'text.secondary' }}>
        已选择 {count} 项
      </Typography>
      <Button size="small" onClick={onCreateGroup}>新建分组</Button>
      <Button size="small" onClick={onMoveToGroup}>加入分组</Button>
      <Button size="small" onClick={onUngroup}>移出分组</Button>
      <Button size="small" color="inherit" onClick={onClear}>取消选择</Button>
    </Box>
  )
}
```

- [ ] **Step 4: Create service list item**

Create `src/components/service-info/ServiceListItem.tsx`:

```tsx
import React from 'react'
import { Box, Checkbox, Chip, IconButton, Tooltip, Typography } from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import type { SecretServiceRow } from '../../types'

export default function ServiceListItem({
  service,
  selected,
  checked,
  onClick,
  onToggleSelected,
  onToggleFavorite,
}: {
  service: SecretServiceRow
  selected: boolean
  checked: boolean
  onClick: () => void
  onToggleSelected: () => void
  onToggleFavorite: () => void
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        px: 1.5,
        py: 1.25,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: selected ? 'action.selected' : 'transparent',
        cursor: 'pointer',
        '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
      }}
    >
      <DragIndicatorIcon sx={{ fontSize: 18, color: 'text.disabled', mt: 0.4 }} />
      <Checkbox size="small" checked={checked} onClick={(event) => { event.stopPropagation(); onToggleSelected() }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
          {service.name}
        </Typography>
        <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary' }}>
          {service.description || service.url || '未填写用途说明'}
        </Typography>
        {service.linked_account_id && (
          <Chip size="small" label="已关联账号" sx={{ height: 20, mt: 0.75 }} />
        )}
      </Box>
      <Tooltip title={service.is_favorite ? '取消收藏' : '收藏'}>
        <IconButton size="small" onClick={(event) => { event.stopPropagation(); onToggleFavorite() }}>
          {service.is_favorite ? <StarIcon sx={{ fontSize: 18, color: '#fdd663' }} /> : <StarBorderIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  )
}
```

- [ ] **Step 5: Create service group list**

Create `src/components/service-info/ServiceGroupList.tsx`:

```tsx
import React from 'react'
import { Box, Button, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import type { SecretGroupRow, SecretServiceRow, ServiceInfoSortMode } from '../../types'
import { getGroupedItems, sortServiceInfoItems } from '../../utils/serviceInfoGrouping'
import ServiceListItem from './ServiceListItem'

export default function ServiceGroupList({
  groups,
  services,
  sortMode,
  selectedServiceId,
  selectedIds,
  onCreateService,
  onSelectService,
  onToggleSelected,
  onToggleFavorite,
}: {
  groups: SecretGroupRow[]
  services: SecretServiceRow[]
  sortMode: ServiceInfoSortMode
  selectedServiceId: string | null
  selectedIds: string[]
  onCreateService: () => void
  onSelectService: (id: string) => void
  onToggleSelected: (id: string) => void
  onToggleFavorite: (service: SecretServiceRow) => void
}) {
  const grouped = getGroupedItems(sortServiceInfoItems(services, sortMode))

  if (services.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', px: 3, py: 8 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          还没有服务信息
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onCreateService}>
          新建服务
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      {grouped.ungrouped.length > 0 && (
        <Box>
          <Typography variant="caption" sx={{ display: 'block', px: 2, py: 1, color: 'text.secondary', fontWeight: 700 }}>
            未分组
          </Typography>
          {grouped.ungrouped.map((service) => (
            <ServiceListItem
              key={service.id}
              service={service}
              selected={selectedServiceId === service.id}
              checked={selectedIds.includes(service.id)}
              onClick={() => onSelectService(service.id)}
              onToggleSelected={() => onToggleSelected(service.id)}
              onToggleFavorite={() => onToggleFavorite(service)}
            />
          ))}
        </Box>
      )}

      {groups.map((group) => {
        const items = grouped.groups[group.id] || []
        if (items.length === 0) return null
        return (
          <Box key={group.id}>
            <Typography variant="caption" sx={{ display: 'block', px: 2, py: 1, color: group.color, fontWeight: 700 }}>
              {group.name}
            </Typography>
            {items.map((service) => (
              <ServiceListItem
                key={service.id}
                service={service}
                selected={selectedServiceId === service.id}
                checked={selectedIds.includes(service.id)}
                onClick={() => onSelectService(service.id)}
                onToggleSelected={() => onToggleSelected(service.id)}
                onToggleFavorite={() => onToggleFavorite(service)}
              />
            ))}
          </Box>
        )
      })}
    </Box>
  )
}
```

- [ ] **Step 6: Create the manager shell**

Create `src/components/service-info/ServiceInfoManager.tsx`:

```tsx
import React, { useEffect, useMemo } from 'react'
import { Box, IconButton, InputAdornment, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '../../stores/useStore'
import type { ServiceInfoSortMode } from '../../types'
import BatchActionBar from './BatchActionBar'
import ServiceGroupList from './ServiceGroupList'

export default function ServiceInfoManager() {
  const {
    clearSelectedServiceIds,
    loadServiceInfo,
    secretServices,
    selectedServiceId,
    selectedServiceIds,
    serviceGroups,
    serviceSearchQuery,
    serviceSortMode,
    setSelectedService,
    setServiceSearchQuery,
    setServiceSortMode,
    toggleSelectedServiceId,
  } = useStore()

  useEffect(() => {
    loadServiceInfo()
  }, [loadServiceInfo])

  const filteredServices = useMemo(() => {
    const query = serviceSearchQuery.trim().toLowerCase()
    if (!query) return secretServices
    return secretServices.filter((service) =>
      [service.name, service.description, service.url, service.notes].some((value) => value.toLowerCase().includes(query))
    )
  }, [secretServices, serviceSearchQuery])

  const handleCreateService = async () => {
    const id = uuidv4()
    await window.electronAPI.createSecretService({ id, name: '新的服务信息' })
    await loadServiceInfo()
    setSelectedService(id)
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ width: 380, minWidth: 380, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700 }}>
            服务信息
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem', mt: 0.75 }}>
            自定义保存 API、服务器、MCP、金融和其他资料。
          </Typography>
        </Box>

        <Box sx={{ p: 1.5, display: 'flex', gap: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            size="small"
            label="搜索服务信息"
            value={serviceSearchQuery}
            onChange={(event) => setServiceSearchQuery(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1 }}
          />
          <TextField
            select
            size="small"
            value={serviceSortMode}
            onChange={(event) => setServiceSortMode(event.target.value as ServiceInfoSortMode)}
            sx={{ width: 120 }}
          >
            <MenuItem value="manual">手动</MenuItem>
            <MenuItem value="name-asc">名称 A-Z</MenuItem>
            <MenuItem value="name-desc">名称 Z-A</MenuItem>
            <MenuItem value="updated-desc">最新</MenuItem>
            <MenuItem value="updated-asc">最旧</MenuItem>
            <MenuItem value="favorites-first">收藏优先</MenuItem>
          </TextField>
          <Tooltip title="新建服务">
            <IconButton onClick={handleCreateService} sx={{ color: 'primary.main' }}>
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <BatchActionBar
          count={selectedServiceIds.length}
          onClear={clearSelectedServiceIds}
          onCreateGroup={() => {}}
          onMoveToGroup={() => {}}
          onUngroup={() => {}}
        />

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <ServiceGroupList
            groups={serviceGroups}
            services={filteredServices}
            sortMode={serviceSortMode}
            selectedServiceId={selectedServiceId}
            selectedIds={selectedServiceIds}
            onCreateService={handleCreateService}
            onSelectService={setSelectedService}
            onToggleSelected={toggleSelectedServiceId}
            onToggleFavorite={async (service) => {
              await window.electronAPI.updateSecretService(service.id, { isFavorite: service.is_favorite ? 0 : 1 })
              await loadServiceInfo()
            }}
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          选择或创建一个服务信息
        </Typography>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 7: Route the module**

Update `src/App.tsx`:

```ts
import ServiceInfoManager from './components/service-info/ServiceInfoManager'
```

Add the route:

```tsx
{activeView === 'service-info' && <ServiceInfoManager />}
```

- [ ] **Step 8: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```powershell
git add -- src/App.tsx src/components/Sidebar.tsx src/stores/useStore.ts src/components/service-info
git commit -m "feat: 增加服务信息列表入口"
```

## Task 7: Service Detail Fields and Field Groups

**Files:**
- Create: `src/components/service-info/ServiceDetail.tsx`
- Create: `src/components/service-info/ServiceFieldGroup.tsx`
- Create: `src/components/service-info/ServiceFieldRow.tsx`
- Modify: `src/components/service-info/ServiceInfoManager.tsx`

- [ ] **Step 1: Create field row**

Create `src/components/service-info/ServiceFieldRow.tsx`:

```tsx
import React, { useState } from 'react'
import { Box, Checkbox, IconButton, Tooltip, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import type { SecretFieldRow } from '../../types'

export default function ServiceFieldRow({
  field,
  checked,
  onToggleSelected,
}: {
  field: SecretFieldRow
  checked: boolean
  onToggleSelected: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const isSecret = Boolean(field.is_secret)
  const displayedValue = isSecret && !visible ? '••••••••' : field.field_value

  const copyValue = async () => {
    await navigator.clipboard.writeText(field.field_value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, px: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Checkbox size="small" checked={checked} onChange={onToggleSelected} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          {field.field_name}
        </Typography>
        <Typography variant="body2" noWrap sx={{ fontFamily: isSecret ? 'monospace' : 'inherit' }}>
          {displayedValue || '(空)'}
        </Typography>
      </Box>
      {isSecret && (
        <Tooltip title={visible ? '隐藏' : '显示'}>
          <IconButton size="small" onClick={() => setVisible(!visible)}>
            {visible ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={copied ? '已复制' : '复制'}>
        <IconButton size="small" onClick={copyValue} sx={{ color: copied ? 'success.main' : 'text.secondary' }}>
          {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  )
}
```

- [ ] **Step 2: Create field group block**

Create `src/components/service-info/ServiceFieldGroup.tsx`:

```tsx
import React from 'react'
import { Box, Typography } from '@mui/material'
import type { SecretFieldGroupRow, SecretFieldRow } from '../../types'
import ServiceFieldRow from './ServiceFieldRow'

export default function ServiceFieldGroup({
  title,
  color,
  fields,
  selectedIds,
  onToggleSelected,
}: {
  title: string
  color?: string
  fields: SecretFieldRow[]
  selectedIds: string[]
  onToggleSelected: (id: string) => void
  group?: SecretFieldGroupRow
}) {
  if (fields.length === 0) return null

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" sx={{ color: color || 'text.secondary', fontWeight: 700, display: 'block', mb: 0.75 }}>
        {title}
      </Typography>
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        {fields.map((field) => (
          <ServiceFieldRow
            key={field.id}
            field={field}
            checked={selectedIds.includes(field.id)}
            onToggleSelected={() => onToggleSelected(field.id)}
          />
        ))}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 3: Create service detail panel**

Create `src/components/service-info/ServiceDetail.tsx`:

```tsx
import React, { useMemo, useState } from 'react'
import { Box, Button, Chip, InputAdornment, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '../../stores/useStore'
import { getGroupedItems } from '../../utils/serviceInfoGrouping'
import BatchActionBar from './BatchActionBar'
import ServiceFieldGroup from './ServiceFieldGroup'

export default function ServiceDetail() {
  const {
    clearSelectedFieldIds,
    loadServiceDetail,
    selectedFieldIds,
    selectedServiceDetail,
    toggleSelectedFieldId,
  } = useStore()
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')

  const groupedFields = useMemo(() => {
    return getGroupedItems(selectedServiceDetail?.fields || [])
  }, [selectedServiceDetail])

  if (!selectedServiceDetail) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          选择或创建一个服务信息
        </Typography>
      </Box>
    )
  }

  const { service, fieldGroups } = selectedServiceDetail

  const createField = async () => {
    if (!newFieldName.trim()) return
    await window.electronAPI.createSecretField({
      id: uuidv4(),
      serviceId: service.id,
      fieldName: newFieldName.trim(),
      fieldValue: newFieldValue,
      isSecret: true,
    })
    setNewFieldName('')
    setNewFieldValue('')
    await loadServiceDetail(service.id)
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {service.name}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {service.description || '未填写用途说明'}
        </Typography>
        {service.url && <Chip size="small" label={service.url} sx={{ mt: 1 }} />}
      </Box>

      <BatchActionBar
        count={selectedFieldIds.length}
        onClear={clearSelectedFieldIds}
        onCreateGroup={() => {}}
        onMoveToGroup={() => {}}
        onUngroup={() => {}}
      />

      <Box sx={{ p: 2, display: 'flex', gap: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <TextField
          size="small"
          label="字段名"
          value={newFieldName}
          onChange={(event) => setNewFieldName(event.target.value)}
          sx={{ width: 180 }}
        />
        <TextField
          size="small"
          label="字段值"
          value={newFieldValue}
          onChange={(event) => setNewFieldValue(event.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start">密</InputAdornment>,
          }}
          sx={{ flex: 1 }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={createField}>
          添加字段
        </Button>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        <ServiceFieldGroup
          title="未分组"
          fields={groupedFields.ungrouped}
          selectedIds={selectedFieldIds}
          onToggleSelected={toggleSelectedFieldId}
        />
        {fieldGroups.map((group) => (
          <ServiceFieldGroup
            key={group.id}
            title={group.name}
            color={group.color}
            fields={groupedFields.groups[group.id] || []}
            selectedIds={selectedFieldIds}
            onToggleSelected={toggleSelectedFieldId}
          />
        ))}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Render detail from manager**

Update `src/components/service-info/ServiceInfoManager.tsx`:

```ts
import ServiceDetail from './ServiceDetail'
```

Replace the right-side empty panel with:

```tsx
<ServiceDetail />
```

- [ ] **Step 5: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- src/components/service-info
git commit -m "feat: 增加服务详情字段管理"
```

## Task 8: Import and Export Service Information

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Extend JSON export**

Inside the JSON export `data` object in `electron/main.ts`, add:

```ts
secretGroups: db.prepare('SELECT * FROM secret_groups').all(),
secretServices: db.prepare('SELECT * FROM secret_services').all(),
secretFieldGroups: db.prepare('SELECT * FROM secret_field_groups').all(),
secretFields: db.prepare('SELECT * FROM secret_fields').all(),
```

Change export version to:

```ts
version: 5,
```

- [ ] **Step 2: Extend JSON import**

Inside the JSON import transaction in `electron/main.ts`, delete new tables before deleting old tables:

```ts
db.prepare('DELETE FROM secret_fields').run()
db.prepare('DELETE FROM secret_field_groups').run()
db.prepare('DELETE FROM secret_services').run()
db.prepare('DELETE FROM secret_groups').run()
```

After account-tag import, add:

```ts
const insertSecretGroup = db.prepare('INSERT INTO secret_groups (id, name, color, sort_order, is_collapsed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
for (const group of data.secretGroups || []) {
  insertSecretGroup.run(group.id, group.name, group.color || '#a8c7fa', group.sort_order || 0, group.is_collapsed || 0, group.created_at, group.updated_at)
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
    service.created_at,
    service.updated_at
  )
}

const insertSecretFieldGroup = db.prepare('INSERT INTO secret_field_groups (id, service_id, name, color, sort_order, is_collapsed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
for (const group of data.secretFieldGroups || []) {
  insertSecretFieldGroup.run(group.id, group.service_id, group.name, group.color || '#a8c7fa', group.sort_order || 0, group.is_collapsed || 0, group.created_at, group.updated_at)
}

const insertSecretField = db.prepare('INSERT INTO secret_fields (id, service_id, group_id, field_name, field_value, is_secret, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
for (const field of data.secretFields || []) {
  insertSecretField.run(field.id, field.service_id, field.group_id || null, field.field_name, field.field_value || '', field.is_secret ?? 1, field.sort_order || 0, field.created_at, field.updated_at)
}
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```powershell
git add -- electron/main.ts
git commit -m "feat: 支持服务信息导入导出"
```

## Task 9: Sidebar Collapse, Preferences, and Data Directory

**Files:**
- Create: `src/components/common/ResizableSidebar.tsx`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add preference and data-directory IPC**

In `src/types.ts`, extend `ElectronAPI`:

```ts
getAppPreferences: () => Promise<Record<string, unknown>>
updateAppPreferences: (patch: Record<string, unknown>) => Promise<Record<string, unknown>>
resetAppPreferences: () => Promise<Record<string, unknown>>
```

In `electron/preload.ts`, expose:

```ts
getAppPreferences: () => ipcRenderer.invoke('preferences:get'),
updateAppPreferences: (patch: any) => ipcRenderer.invoke('preferences:update', patch),
resetAppPreferences: () => ipcRenderer.invoke('preferences:reset'),
```

In `electron/main.ts`, add a simple JSON preference object in memory and persisted with `fs.writeFileSync` to `app.getPath('userData')/preferences.json`. Register:

```ts
ipcMain.handle('preferences:get', () => readPreferences())
ipcMain.handle('preferences:update', (_event, patch: Record<string, unknown>) => {
  const next = { ...readPreferences(), ...patch }
  writePreferences(next)
  return next
})
ipcMain.handle('preferences:reset', () => {
  writePreferences({})
  return {}
})
```

- [ ] **Step 2: Create the reusable resizable sidebar shell**

Create `src/components/common/ResizableSidebar.tsx`:

```tsx
import React, { useState } from 'react'
import { Box, IconButton, Tooltip } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

export default function ResizableSidebar({
  width,
  collapsed,
  minWidth = 180,
  maxWidth = 420,
  collapseThreshold = 120,
  onWidthChange,
  onCollapsedChange,
  children,
}: {
  width: number
  collapsed: boolean
  minWidth?: number
  maxWidth?: number
  collapseThreshold?: number
  onWidthChange: (width: number) => void
  onCollapsedChange: (collapsed: boolean) => void
  children: React.ReactNode
}) {
  const [dragging, setDragging] = useState(false)

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault()
    setDragging(true)
    const startX = event.clientX
    const startWidth = width

    const move = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(40, Math.min(maxWidth, startWidth + (moveEvent.clientX - startX)))
      if (nextWidth < collapseThreshold) {
        onCollapsedChange(true)
      } else {
        onCollapsedChange(false)
        onWidthChange(Math.max(minWidth, nextWidth))
      }
    }

    const stop = () => {
      setDragging(false)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', stop)
    }

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', position: 'relative' }}>
      <Box
        sx={{
          width: collapsed ? 52 : width,
          minWidth: collapsed ? 52 : width,
          borderRight: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          transition: dragging ? 'none' : 'width 0.18s ease, min-width 0.18s ease',
        }}
      >
        {children}
      </Box>
      <Tooltip title={collapsed ? '展开侧边栏' : '折叠侧边栏'}>
        <IconButton
          size="small"
          onClick={() => onCollapsedChange(!collapsed)}
          sx={{ position: 'absolute', right: -16, top: 12, zIndex: 20, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
        >
          {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      {!collapsed && (
        <Box
          onMouseDown={startResize}
          sx={{
            width: 6,
            cursor: 'col-resize',
            position: 'absolute',
            right: -3,
            top: 0,
            bottom: 0,
            zIndex: 10,
            bgcolor: dragging ? 'primary.main' : 'transparent',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        />
      )}
    </Box>
  )
}
```

- [ ] **Step 3: Use preferences from App shell**

Update `src/App.tsx` so sidebar width and collapse state are initialized from preferences and persisted through `updateAppPreferences`. Replace direct `localStorage` reads/writes for `app_sidebar_width`.

- [ ] **Step 4: Add data directory action to sidebar**

In `src/components/Sidebar.tsx`, add a bottom button:

```tsx
<Button size="small" onClick={() => window.electronAPI.openDataDirectory()}>
  打开数据目录
</Button>
```

- [ ] **Step 5: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- electron/main.ts electron/preload.ts src/types.ts src/App.tsx src/components/Sidebar.tsx src/components/common/ResizableSidebar.tsx
git commit -m "refactor: 优化侧栏折叠和偏好存储"
```

## Task 10: Visual Restraint and README

**Files:**
- Modify: `src/theme/index.ts`
- Modify: `README.md`

- [ ] **Step 1: Restrain shared theme defaults**

In `src/theme/index.ts`, reduce shared shell decoration:

```ts
shape: {
  borderRadius: 8,
},
```

For `MuiButton.styleOverrides.root`, use:

```ts
borderRadius: 8,
padding: '7px 16px',
```

For `MuiDialog.styleOverrides.paper`, use:

```ts
borderRadius: 10,
backgroundImage: 'none',
```

Keep primary colors and existing dark/light palettes intact to avoid a full redesign.

- [ ] **Step 2: Document the new local service information area**

Add to `README.md` under core features:

```md
### 5. 服务信息库

- 用完全自定义的服务记录保存 API Key、服务器信息、MCP 配置、云厂商凭证和其他重要资料
- 支持外部分组与服务内部字段分组
- 敏感字段默认隐藏并加密保存
- 升级前会自动备份本地数据库，优先保护已有账号与 2FA 数据
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```powershell
git add -- src/theme/index.ts README.md
git commit -m "style: 收敛桌面管理工具视觉规范"
```

## Task 11: Final Verification

**Files:**
- Modify only files needed for fixes found by verification.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm test -- electron/databaseSafety.test.ts src/utils/serviceInfoGrouping.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run all tests**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```powershell
npm run build
```

Expected: Vite and Electron Builder complete successfully. If packaging takes too long on this machine, run `npm run typecheck` and `npm test` again, then record the packaging blocker in the final response.

- [ ] **Step 5: Inspect git status**

Run:

```powershell
git status --short
```

Expected: only the user's pre-existing untracked backup/diff files remain untracked, or no output if the user later removed them.

- [ ] **Step 6: Commit verification fixes when needed**

If Step 1 through Step 4 required code fixes, run:

```powershell
git add -- <fixed-files>
git commit -m "test: 补充服务信息与迁移保护测试"
```

If no fixes were needed, do not create an empty commit.

## Plan Self-Review

Spec coverage:

- Existing data protection is covered by Task 1, Task 2, Task 8, and Task 11.
- First-class `服务信息` navigation is covered by Task 6.
- Fully custom service records and fields are covered by Task 3 through Task 7.
- Service and field grouping behavior is covered by Task 4, Task 5, Task 6, and Task 7.
- Import/export compatibility is covered by Task 8.
- Desktop standards for sidebar, search, sorting, empty states, preferences, and data directory access are covered by Task 6, Task 9, and Task 10.
- Small Chinese commits are included at the end of every implementation task.

Placeholder scan:

- This plan contains no unfinished sections.
- Every task names exact files and exact verification commands.

Type consistency:

- Service row, group row, field group row, and field row names match the `src/types.ts` additions.
- Electron API method names match `electron/preload.ts`, `src/types.ts`, and `electron/serviceInfoRepository.ts`.
- Grouping helper names match the tests and store usage.
