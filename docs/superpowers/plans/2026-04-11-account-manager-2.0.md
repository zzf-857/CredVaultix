# AccountManager 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the app from a generic local account vault into a platform-aware AccountManager 2.0 with AI entitlement tracking and official OpenAI/Google connector support.

**Architecture:** Keep the app offline-first with SQLite in Electron main, split the current monolithic IPC/database code into focused database, security, connector, and IPC modules, then replace the account renderer with a platform-aware account workspace. External sync runs only through official user-provided credentials or OAuth authorization and writes normalized entitlement, usage, and sync records.

**Tech Stack:** Electron 31, Vite 5, React 18, TypeScript, MUI v5, Zustand, better-sqlite3, Vitest for focused Node-side tests, built-in `fetch` in Electron main for connector HTTP calls.

---

## Source Spec

Implement against `docs/superpowers/specs/2026-04-11-account-manager-2.0-design.md`.

Use these design decisions from the spec:

- Master password is deferred to 2.1, but secret values need a versioned envelope now.
- Google OAuth uses user-provided OAuth client configuration.
- Connector tests use mocked HTTP by default.
- Keep account organization platform-filter based; do not add account-specific folder trees in 2.0.
- Do not implement cookie extraction, browser session extraction, or webpage scraping.

## File Structure

Create these backend files:

- `electron/db/schema.ts`: SQLite schema creation, versioned migrations, built-in platform seed.
- `electron/db/accounts.ts`: account, platform profile, credential, entitlement, usage, connector, sync-log, and audit CRUD.
- `electron/db/importExport.ts`: version 3 JSON export/import and legacy compatibility.
- `electron/security/secretStore.ts`: versioned AES-256-GCM encrypt/decrypt/redact helper.
- `electron/connectors/types.ts`: connector interfaces and normalized result types.
- `electron/connectors/openai.ts`: OpenAI API Platform validation and sync.
- `electron/connectors/google.ts`: Google OAuth/profile/cloud API validation and sync.
- `electron/connectors/registry.ts`: connector lookup and sync orchestration.
- `electron/ipc/account2.ts`: platform-aware account IPC handlers.
- `electron/ipc/connectors.ts`: connector IPC handlers.

Modify these backend files:

- `electron/database.ts`: delegate schema creation to `electron/db/schema.ts` and expose a testable `openDatabase` helper.
- `electron/main.ts`: register new AccountManager 2.0 IPC modules while keeping prompt/TOTP legacy handlers stable.
- `electron/preload.ts`: expose new IPC methods to the renderer.
- `electron/crypto.ts`: keep compatibility exports backed by `SecretStore`.

Create these renderer files:

- `src/types/account2.ts`: platform, credential, entitlement, usage, connector, sync-log, and IPC data types.
- `src/stores/accountStore.ts`: AccountManager 2.0 state and async actions.
- `src/components/accounts/AccountManager2.tsx`: account workspace shell.
- `src/components/accounts/AccountList.tsx`: filters, search, platform badges, status badges.
- `src/components/accounts/AccountDetail.tsx`: account detail tabs.
- `src/components/accounts/PlatformTemplateDialog.tsx`: OpenAI/Google/generic account creation.
- `src/components/accounts/tabs/BasicInfoTab.tsx`
- `src/components/accounts/tabs/CredentialsTab.tsx`
- `src/components/accounts/tabs/EntitlementsTab.tsx`
- `src/components/accounts/tabs/UsageTab.tsx`
- `src/components/accounts/tabs/FamilyTeamTab.tsx`
- `src/components/accounts/tabs/SyncLogTab.tsx`
- `src/components/connectors/OpenAIConnectorDialog.tsx`
- `src/components/connectors/GoogleConnectorDialog.tsx`

Modify these renderer files:

- `src/types.ts`: extend `ElectronAPI` with new 2.0 methods.
- `src/App.tsx`: render `AccountManager2` for `activeView === 'accounts'`.
- `src/components/Sidebar.tsx`: keep existing navigation labels but allow platform-aware account view to own account filtering.
- `src/stores/useStore.ts`: keep prompt/TOTP/global state; remove new account feature work from this store once `accountStore` owns it.

Create these test files:

- `vitest.config.ts`
- `electron/test-utils/tempDb.ts`
- `electron/db/schema.test.ts`
- `electron/security/secretStore.test.ts`
- `electron/db/accounts.test.ts`
- `electron/db/importExport.test.ts`
- `electron/connectors/openai.test.ts`
- `electron/connectors/google.test.ts`

## Task 1: Add Test Harness

**Files:**

- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `electron/test-utils/tempDb.ts`

- [ ] **Step 1: Install test dependency**

Run:

```powershell
npm install -D vitest
```

Expected: `package.json` and `package-lock.json` include `vitest` in dev dependencies.

- [ ] **Step 2: Add test scripts**

Modify the `scripts` section in `package.json` so it contains:

```json
{
  "dev": "vite",
  "build": "vite build && electron-builder",
  "preview": "vite preview",
  "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
  "electron:build": "vite build && electron-builder --win",
  "postinstall": "electron-rebuild",
  "rebuild": "electron-rebuild",
  "typecheck": "tsc -b",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['electron/**/*.test.ts'],
    globals: false,
    pool: 'forks',
  },
})
```

- [ ] **Step 4: Create temporary database helper**

Create `electron/test-utils/tempDb.ts`:

```ts
import Database from 'better-sqlite3'
import fs from 'fs'
import os from 'os'
import path from 'path'

export interface TempDatabase {
  db: Database.Database
  dbPath: string
  dir: string
  cleanup: () => void
}

export function createTempDatabase(prefix = 'account-manager-test-'): TempDatabase {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  const dbPath = path.join(dir, 'test.db')
  const db = new Database(dbPath)

  return {
    db,
    dbPath,
    dir,
    cleanup: () => {
      try {
        db.close()
      } catch {
        // Already closed.
      }
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}
```

- [ ] **Step 5: Run empty test suite**

Run:

```powershell
npm test
```

Expected: Vitest exits successfully with no matched tests or with zero failing tests.

- [ ] **Step 6: Commit**

Run:

```powershell
git add package.json package-lock.json vitest.config.ts electron/test-utils/tempDb.ts
git commit -m "test: add vitest harness"
```

## Task 2: Add Schema Migrations

**Files:**

- Create: `electron/db/schema.ts`
- Create: `electron/db/schema.test.ts`
- Modify: `electron/database.ts`

- [ ] **Step 1: Write migration tests first**

Create `electron/db/schema.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { createTempDatabase, TempDatabase } from '../test-utils/tempDb'
import { getTableColumns, runMigrations } from './schema'

let temp: TempDatabase | null = null

afterEach(() => {
  temp?.cleanup()
  temp = null
})

function createLegacyAccountTables(db: TempDatabase['db']) {
  db.exec(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT DEFAULT '',
      password TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      backup_email TEXT DEFAULT '',
      totp_secret TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      folder_id TEXT,
      is_favorite INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE account_custom_fields (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      field_name TEXT NOT NULL,
      field_value TEXT DEFAULT '',
      is_secret INTEGER DEFAULT 0
    );
  `)
  db.prepare(`
    INSERT INTO accounts (id, name, username, created_at, updated_at)
    VALUES ('acc-1', 'Old OpenAI Account', 'user@example.com', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
  `).run()
}

describe('schema migrations', () => {
  it('creates 2.0 tables and seeds built-in platforms on a fresh database', () => {
    temp = createTempDatabase()

    runMigrations(temp.db)

    const platform = temp.db.prepare("SELECT key, name FROM platforms WHERE key = 'openai'").get() as any
    expect(platform).toEqual({ key: 'openai', name: 'OpenAI' })

    const entitlementColumns = getTableColumns(temp.db, 'account_entitlements')
    expect(entitlementColumns).toContain('quota_remaining')
  })

  it('adds missing custom field sort_order and creates generic profiles for legacy accounts', () => {
    temp = createTempDatabase()
    createLegacyAccountTables(temp.db)

    runMigrations(temp.db)

    expect(getTableColumns(temp.db, 'account_custom_fields')).toContain('sort_order')

    const profile = temp.db.prepare(`
      SELECT p.key AS platform_key, app.display_identifier
      FROM account_platform_profiles app
      JOIN platforms p ON p.id = app.platform_id
      WHERE app.account_id = 'acc-1'
    `).get() as any

    expect(profile).toEqual({
      platform_key: 'generic',
      display_identifier: 'user@example.com',
    })
  })
})
```

- [ ] **Step 2: Run schema tests and confirm failure**

Run:

```powershell
npm test -- electron/db/schema.test.ts
```

Expected: FAIL because `electron/db/schema.ts` does not exist.

- [ ] **Step 3: Implement schema module**

Create `electron/db/schema.ts` with these exports and responsibilities:

```ts
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

export function getTableColumns(db: Database.Database, tableName: string): string[] {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().map((row: any) => row.name)
}

export function runMigrations(db: Database.Database) {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const migrate = db.transaction(() => {
    ensureBaseSchema(db)
    migrateLegacyColumns(db)
    seedBuiltInPlatforms(db)
    createGenericProfilesForExistingAccounts(db)
    markMigration(db, '2.0.0')
  })

  migrate()
}
```

Implement the private helpers in the same file:

- `tableExists(db, tableName)`
- `addColumnIfMissing(db, tableName, columnName, definition)`
- `ensureBaseSchema(db)` with all legacy tables plus new `schema_migrations`, `platforms`, `account_platform_profiles`, `account_credentials`, `account_entitlements`, `usage_snapshots`, `connector_accounts`, `connector_sync_runs`, and `audit_events`.
- `seedBuiltInPlatforms(db)` with keys `openai`, `google`, `anthropic`, `microsoft`, `github`, `generic_ai`, and `generic`.
- `migrateLegacyColumns(db)` adding `totp_accounts.otp_type`, `totp_accounts.counter`, `totp_accounts.linked_account_id`, and `account_custom_fields.sort_order`.
- `createGenericProfilesForExistingAccounts(db)` creating a generic platform profile for accounts that do not have one.
- `markMigration(db, version)`.

The `ensureBaseSchema` SQL must match the data model in the design spec and add indexes for account profiles, credentials, entitlements, usage snapshots, connector accounts, and sync runs.

- [ ] **Step 4: Update database initialization**

Replace `electron/database.ts` with:

```ts
import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { runMigrations } from './db/schema'

let db: Database.Database

export function openDatabase(dbPath: string) {
  const database = new Database(dbPath)
  runMigrations(database)
  return database
}

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'account-manager.db')
  db = openDatabase(dbPath)
}

export function getDatabase() {
  return db
}
```

- [ ] **Step 5: Run schema tests**

Run:

```powershell
npm test -- electron/db/schema.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run build type check**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add electron/db/schema.ts electron/db/schema.test.ts electron/database.ts
git commit -m "feat: add account manager 2 schema migrations"
```

## Task 3: Add Versioned Secret Store

**Files:**

- Create: `electron/security/secretStore.ts`
- Create: `electron/security/secretStore.test.ts`
- Modify: `electron/crypto.ts`

- [ ] **Step 1: Write tests first**

Create `electron/security/secretStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createSecretStore, redactSecret } from './secretStore'

describe('secretStore', () => {
  it('encrypts with a versioned envelope and decrypts plaintext', () => {
    const store = createSecretStore('test-seed')

    const encrypted = store.encrypt('sk-test-secret')

    expect(encrypted).toMatch(/^v2:/)
    expect(encrypted).not.toContain('sk-test-secret')
    expect(store.decrypt(encrypted)).toBe('sk-test-secret')
  })

  it('returns legacy plaintext unchanged for backwards compatibility', () => {
    const store = createSecretStore('test-seed')

    expect(store.decrypt('plain-value')).toBe('plain-value')
  })

  it('redacts keys without exposing the full secret', () => {
    expect(redactSecret('sk-proj-abcdefghijklmnopqrstuvwxyz')).toBe('sk-p...wxyz')
    expect(redactSecret('short')).toBe('*****')
  })
})
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```powershell
npm test -- electron/security/secretStore.test.ts
```

Expected: FAIL because `secretStore.ts` does not exist.

- [ ] **Step 3: Implement SecretStore**

Create `electron/security/secretStore.ts`:

```ts
import crypto from 'crypto'
import { app } from 'electron'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const VERSION = 'v2'

export interface SecretStore {
  encrypt: (plaintext: string) => string
  decrypt: (ciphertext: string) => string
}

function deriveKey(seed: string) {
  return crypto.createHash('sha256').update(seed).digest()
}

function defaultSeed() {
  return `AccountManager-${app.getPath('userData')}-local-key-v2`
}

export function createSecretStore(seed = defaultSeed()): SecretStore {
  return {
    encrypt(plaintext: string) {
      if (!plaintext) return ''
      const key = deriveKey(seed)
      const iv = crypto.randomBytes(IV_LENGTH)
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
      const tag = cipher.getAuthTag()
      return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
    },

    decrypt(ciphertext: string) {
      if (!ciphertext) return ''
      if (!ciphertext.startsWith(`${VERSION}:`)) return ciphertext

      try {
        const [, ivBase64, tagBase64, encryptedBase64] = ciphertext.split(':')
        const key = deriveKey(seed)
        const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivBase64, 'base64'))
        decipher.setAuthTag(Buffer.from(tagBase64, 'base64'))
        return Buffer.concat([
          decipher.update(Buffer.from(encryptedBase64, 'base64')),
          decipher.final(),
        ]).toString('utf8')
      } catch {
        return ciphertext
      }
    },
  }
}

export function redactSecret(value: string) {
  if (!value) return ''
  if (value.length <= 8) return '*'.repeat(value.length)
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

export const secretStore = createSecretStore()
```

- [ ] **Step 4: Update crypto compatibility wrapper**

Replace `electron/crypto.ts` with:

```ts
import { secretStore } from './security/secretStore'

export function encrypt(plaintext: string): string {
  return secretStore.encrypt(plaintext)
}

export function decrypt(ciphertext: string): string {
  return secretStore.decrypt(ciphertext)
}
```

- [ ] **Step 5: Run tests**

Run:

```powershell
npm test -- electron/security/secretStore.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add electron/security/secretStore.ts electron/security/secretStore.test.ts electron/crypto.ts
git commit -m "feat: add versioned secret store"
```

## Task 4: Add Account 2.0 Repository

**Files:**

- Create: `electron/db/accounts.ts`
- Create: `electron/db/accounts.test.ts`

- [ ] **Step 1: Write repository tests first**

Create `electron/db/accounts.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { createTempDatabase, TempDatabase } from '../test-utils/tempDb'
import { runMigrations } from './schema'
import {
  addCredential,
  createAccount2,
  listAccountDetails,
  listPlatforms,
  upsertEntitlement,
  writeUsageSnapshot,
} from './accounts'

let temp: TempDatabase | null = null

afterEach(() => {
  temp?.cleanup()
  temp = null
})

function setup() {
  temp = createTempDatabase()
  runMigrations(temp.db)
  return temp.db
}

describe('account2 repository', () => {
  it('creates an OpenAI account with a platform profile', () => {
    const db = setup()

    const account = createAccount2(db, {
      name: 'OpenAI Main',
      platformKey: 'openai',
      displayIdentifier: 'main@example.com',
    })

    const details = listAccountDetails(db, { search: 'main@example.com' })

    expect(details).toHaveLength(1)
    expect(details[0].id).toBe(account.id)
    expect(details[0].platform_key).toBe('openai')
    expect(details[0].display_identifier).toBe('main@example.com')
  })

  it('stores credentials encrypted and returns only redacted list values', () => {
    const db = setup()
    const account = createAccount2(db, {
      name: 'OpenAI Main',
      platformKey: 'openai',
      displayIdentifier: 'main@example.com',
    })

    addCredential(db, {
      accountId: account.id,
      platformProfileId: account.platformProfileId,
      kind: 'openai_admin_key',
      label: 'Admin key',
      secretValue: 'sk-admin-abcdefghijklmnopqrstuvwxyz',
    })

    const row = db.prepare('SELECT secret_value, public_hint FROM account_credentials').get() as any
    expect(row.secret_value).not.toContain('sk-admin')
    expect(row.public_hint).toBe('sk-a...wxyz')
  })

  it('writes entitlement and usage snapshots', () => {
    const db = setup()
    const account = createAccount2(db, {
      name: 'ChatGPT Plus',
      platformKey: 'openai',
      displayIdentifier: 'plus@example.com',
    })

    upsertEntitlement(db, {
      accountId: account.id,
      platformProfileId: account.platformProfileId,
      source: 'manual',
      planName: 'Plus',
      quotaLabel: 'GPT-5 messages',
      quotaLimit: 80,
      quotaUsed: 12,
      quotaRemaining: 68,
      quotaUnit: 'messages',
    })

    writeUsageSnapshot(db, {
      accountId: account.id,
      platformProfileId: account.platformProfileId,
      source: 'manual',
      metricKey: 'manual.messages.remaining',
      metricLabel: 'Messages remaining',
      value: 68,
      unit: 'messages',
    })

    const details = listAccountDetails(db, { search: 'plus@example.com' })
    expect(details[0].entitlement_count).toBe(1)
    expect(details[0].latest_usage_metric).toBe('manual.messages.remaining')
  })

  it('lists seeded platforms', () => {
    const db = setup()
    const keys = listPlatforms(db).map((p) => p.key)

    expect(keys).toContain('google')
    expect(keys).toContain('openai')
  })
})
```

- [ ] **Step 2: Run repository tests and confirm failure**

Run:

```powershell
npm test -- electron/db/accounts.test.ts
```

Expected: FAIL because `accounts.ts` does not exist.

- [ ] **Step 3: Implement repository module**

Create `electron/db/accounts.ts` with these exported functions:

- `listPlatforms(db)`
- `createAccount2(db, input)`
- `listAccountDetails(db, filters)`
- `addCredential(db, input)`
- `getDecryptedCredential(db, credentialId)`
- `upsertEntitlement(db, input)`
- `writeUsageSnapshot(db, input)`

Use these helper functions:

```ts
function now() {
  return new Date().toISOString()
}

function json(value: unknown) {
  return JSON.stringify(value ?? {})
}

function getPlatformId(db: Database.Database, platformKey: string) {
  const row = db.prepare('SELECT id FROM platforms WHERE key = ?').get(platformKey) as { id: string } | undefined
  if (!row) throw new Error(`Unknown platform: ${platformKey}`)
  return row.id
}
```

`createAccount2` must insert into `accounts` and `account_platform_profiles` in one transaction. `addCredential` must encrypt `secretValue` with `secretStore.encrypt` and store only `redactSecret(secretValue)` in `public_hint`. `listAccountDetails` must return account rows joined with platform profile/platform data plus `credential_count`, `entitlement_count`, and latest usage metric.

- [ ] **Step 4: Run repository tests**

Run:

```powershell
npm test -- electron/db/accounts.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add electron/db/accounts.ts electron/db/accounts.test.ts
git commit -m "feat: add account 2 repository"
```

## Task 5: Add Account 2.0 IPC and Types

**Files:**

- Create: `electron/ipc/account2.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Create: `src/types/account2.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Create renderer account types**

Create `src/types/account2.ts`:

```ts
export interface PlatformRow {
  id: string
  key: string
  name: string
  category: string
  icon: string
  color: string
  is_builtin: number
  created_at: string
  updated_at: string
}

export interface Account2Row {
  id: string
  name: string
  username: string
  notes: string
  is_favorite: number
  created_at: string
  updated_at: string
  platform_profile_id: string | null
  display_identifier: string
  organization_id: string
  project_id: string
  workspace_id: string
  role: string
  profile_status: string
  last_synced_at: string | null
  platform_key: string
  platform_name: string
  platform_category: string
  platform_icon: string
  platform_color: string
  credential_count: number
  entitlement_count: number
  latest_usage_metric: string | null
}

export interface CreateAccount2Data {
  name: string
  platformKey: string
  displayIdentifier?: string
}

export interface Account2Filters {
  search?: string
  platformKey?: string
}

export interface AddCredentialData {
  accountId: string
  platformProfileId?: string | null
  kind: string
  label: string
  secretValue: string
  metadata?: Record<string, unknown>
  expiresAt?: string | null
}

export interface UpsertEntitlementData {
  id?: string
  accountId: string
  platformProfileId?: string | null
  source: string
  planName?: string
  seatType?: string
  billingCycle?: string
  startedAt?: string | null
  expiresAt?: string | null
  renewsAt?: string | null
  quotaLabel?: string
  quotaLimit?: number | null
  quotaUsed?: number | null
  quotaRemaining?: number | null
  quotaUnit?: string
  resetsAt?: string | null
  isFamilyMember?: boolean
  familyRole?: string
  teamRole?: string
  notes?: string
}

export interface WriteUsageSnapshotData {
  accountId: string
  platformProfileId?: string | null
  source: string
  metricKey: string
  metricLabel: string
  value: number
  unit: string
  periodStart?: string | null
  periodEnd?: string | null
}
```

- [ ] **Step 2: Create account IPC module**

Create `electron/ipc/account2.ts`:

```ts
import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import {
  addCredential,
  createAccount2,
  listAccountDetails,
  listPlatforms,
  upsertEntitlement,
  writeUsageSnapshot,
} from '../db/accounts'

export function registerAccount2Ipc(db: Database.Database) {
  ipcMain.handle('account2:platforms', () => listPlatforms(db))
  ipcMain.handle('account2:list', (_event, filters) => listAccountDetails(db, filters || {}))
  ipcMain.handle('account2:create', (_event, input) => createAccount2(db, input))
  ipcMain.handle('account2:addCredential', (_event, input) => addCredential(db, input))
  ipcMain.handle('account2:upsertEntitlement', (_event, input) => upsertEntitlement(db, input))
  ipcMain.handle('account2:writeUsageSnapshot', (_event, input) => writeUsageSnapshot(db, input))
}
```

- [ ] **Step 3: Register IPC module in main process**

In `electron/main.ts`, add this import:

```ts
import { registerAccount2Ipc } from './ipc/account2'
```

Inside `registerIpcHandlers()`, immediately after `const db = getDatabase()`, add:

```ts
  registerAccount2Ipc(db)
```

- [ ] **Step 4: Expose IPC methods in preload**

In `electron/preload.ts`, add these methods to the `exposeInMainWorld` object:

```ts
  getPlatforms2: () => ipcRenderer.invoke('account2:platforms'),
  getAccounts2: (filters?: any) => ipcRenderer.invoke('account2:list', filters),
  createAccount2: (data: any) => ipcRenderer.invoke('account2:create', data),
  addAccountCredential2: (data: any) => ipcRenderer.invoke('account2:addCredential', data),
  upsertAccountEntitlement2: (data: any) => ipcRenderer.invoke('account2:upsertEntitlement', data),
  writeUsageSnapshot2: (data: any) => ipcRenderer.invoke('account2:writeUsageSnapshot', data),
```

- [ ] **Step 5: Extend ElectronAPI**

In `src/types.ts`, import the new types from `./types/account2`, then add these methods to `ElectronAPI`:

```ts
  getPlatforms2: () => Promise<PlatformRow[]>
  getAccounts2: (filters?: Account2Filters) => Promise<Account2Row[]>
  createAccount2: (data: CreateAccount2Data) => Promise<{ id: string; platformProfileId: string }>
  addAccountCredential2: (data: AddCredentialData) => Promise<{ id: string }>
  upsertAccountEntitlement2: (data: UpsertEntitlementData) => Promise<{ id: string }>
  writeUsageSnapshot2: (data: WriteUsageSnapshotData) => Promise<{ id: string }>
```

- [ ] **Step 6: Run checks**

Run:

```powershell
npm run typecheck
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add electron/ipc/account2.ts electron/main.ts electron/preload.ts src/types.ts src/types/account2.ts
git commit -m "feat: expose account 2 ipc"
```

## Task 6: Add Account 2.0 Store

**Files:**

- Create: `src/stores/accountStore.ts`

- [ ] **Step 1: Create store**

Create `src/stores/accountStore.ts` with state for platforms, accounts, selected account, selected platform, search query, loading, and error. It must expose these async actions:

```ts
loadPlatforms: () => Promise<void>
loadAccounts: () => Promise<void>
createAccount: (data: CreateAccount2Data) => Promise<string>
addCredential: (data: AddCredentialData) => Promise<string>
upsertEntitlement: (data: UpsertEntitlementData) => Promise<string>
writeUsageSnapshot: (data: WriteUsageSnapshotData) => Promise<string>
```

Use `window.electronAPI.getPlatforms2`, `getAccounts2`, `createAccount2`, `addAccountCredential2`, `upsertAccountEntitlement2`, and `writeUsageSnapshot2`. After create/update actions, call `loadAccounts()`.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

Run:

```powershell
git add src/stores/accountStore.ts
git commit -m "feat: add account 2 store"
```

## Task 7: Replace Account UI with Platform-Aware Shell

**Files:**

- Create: `src/components/accounts/AccountManager2.tsx`
- Create: `src/components/accounts/AccountList.tsx`
- Create: `src/components/accounts/AccountDetail.tsx`
- Create: `src/components/accounts/PlatformTemplateDialog.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create platform template dialog**

Create `src/components/accounts/PlatformTemplateDialog.tsx` with a dialog that accepts `platforms`, `open`, `onClose`, and `onCreate`. It contains:

- platform select defaulting to `openai`
- account name field
- login email/account identifier field
- create button that calls `onCreate({ name, platformKey, displayIdentifier })`

Use MUI `Dialog`, `TextField`, `MenuItem`, `Button`, and `Box`.

- [ ] **Step 2: Create account list**

Create `src/components/accounts/AccountList.tsx` with props:

```ts
interface AccountListProps {
  accounts: Account2Row[]
  platforms: PlatformRow[]
  selectedAccountId: string | null
  selectedPlatformKey: string | null
  searchQuery: string
  onSearch: (query: string) => void
  onSelectPlatform: (key: string | null) => void
  onSelectAccount: (id: string) => void
  onAdd: () => void
}
```

It renders:

- search field
- add button
- platform chips including "全部"
- account rows with platform name, display identifier, credential count badge, entitlement badge, and sync failed badge

- [ ] **Step 3: Create account detail shell**

Create `src/components/accounts/AccountDetail.tsx` with props:

```ts
interface AccountDetailProps {
  account: Account2Row | null
}
```

It renders an empty-state when `account` is null. When selected, it renders:

- account header with name, platform, and identifier
- scrollable MUI tabs: `基础信息`, `鉴权信息`, `AI权益`, `用量`, `家庭/团队`, `同步日志`
- a tab body that initially says which tab is selected

- [ ] **Step 4: Create AccountManager2 shell**

Create `src/components/accounts/AccountManager2.tsx`:

```tsx
import React, { useEffect, useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { useAccountStore } from '../../stores/accountStore'
import AccountDetail from './AccountDetail'
import AccountList from './AccountList'
import PlatformTemplateDialog from './PlatformTemplateDialog'

export default function AccountManager2() {
  const {
    accounts,
    platforms,
    selectedAccountId,
    selectedPlatformKey,
    searchQuery,
    loadAccounts,
    loadPlatforms,
    setSelectedAccountId,
    setSelectedPlatformKey,
    setSearchQuery,
    createAccount,
  } = useAccountStore()
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    loadPlatforms()
  }, [loadPlatforms])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts, searchQuery, selectedPlatformKey])

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) || null,
    [accounts, selectedAccountId],
  )

  return (
    <Box sx={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
      <AccountList
        accounts={accounts}
        platforms={platforms}
        selectedAccountId={selectedAccountId}
        selectedPlatformKey={selectedPlatformKey}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onSelectPlatform={setSelectedPlatformKey}
        onSelectAccount={setSelectedAccountId}
        onAdd={() => setCreateOpen(true)}
      />
      <AccountDetail account={selectedAccount} />
      <PlatformTemplateDialog
        open={createOpen}
        platforms={platforms}
        onClose={() => setCreateOpen(false)}
        onCreate={async (data) => {
          await createAccount(data)
        }}
      />
    </Box>
  )
}
```

- [ ] **Step 5: Switch App to new account manager**

In `src/App.tsx`, replace the old `AccountManager` import with:

```ts
import AccountManager2 from './components/accounts/AccountManager2'
```

Replace the accounts view render with:

```tsx
{activeView === 'accounts' && <AccountManager2 />}
```

- [ ] **Step 6: Run checks**

Run:

```powershell
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/App.tsx src/components/accounts
git commit -m "feat: add platform aware account shell"
```

## Task 8: Add Editable Account Tabs

**Files:**

- Create: `src/components/accounts/tabs/BasicInfoTab.tsx`
- Create: `src/components/accounts/tabs/CredentialsTab.tsx`
- Create: `src/components/accounts/tabs/EntitlementsTab.tsx`
- Create: `src/components/accounts/tabs/UsageTab.tsx`
- Create: `src/components/accounts/tabs/FamilyTeamTab.tsx`
- Create: `src/components/accounts/tabs/SyncLogTab.tsx`
- Modify: `src/components/accounts/AccountDetail.tsx`

- [ ] **Step 1: Add basic info tab**

Create `BasicInfoTab.tsx`. It displays read-only fields for account name, platform, account identifier, organization ID, project ID, workspace ID, and role using `Account2Row`.

- [ ] **Step 2: Add credentials tab**

Create `CredentialsTab.tsx`. It provides a form with:

- credential kind select: `api_key`, `openai_admin_key`, `oauth_refresh_token`, `recovery_code`, `other_secret`
- label
- secret value password input
- save button

On save, call `useAccountStore().addCredential({ accountId, platformProfileId, kind, label, secretValue })`.

- [ ] **Step 3: Add entitlements tab**

Create `EntitlementsTab.tsx`. It provides fields:

- plan name
- expiry datetime
- quota label
- quota limit
- quota used
- reset datetime
- notes

On save, call `upsertEntitlement` with `source: 'manual'`, compute `quotaRemaining = max(limit - used, 0)` when both values exist, and use `quotaUnit: 'uses'`.

- [ ] **Step 4: Add usage tab**

Create `UsageTab.tsx`. It provides fields:

- metric label
- numeric value
- unit

On save, call `writeUsageSnapshot` with `source: 'manual'` and `metricKey: 'manual.usage'`.

- [ ] **Step 5: Add family/team tab**

Create `FamilyTeamTab.tsx`. It displays a clear manual-only note:

```tsx
ChatGPT 个人家庭信息和 Google 消费级家庭组没有稳定公开 API。这里记录人工维护的家庭/团队备注。
```

Include a multiline notes field. Persisting this field can be added through the entitlement `notes` field in the same tab.

- [ ] **Step 6: Add sync log tab**

Create `SyncLogTab.tsx`. It displays:

- `account.last_synced_at || '尚未同步'`
- `account.profile_status || 'active'`
- `account.latest_usage_metric || '暂无用量快照'`

- [ ] **Step 7: Wire tabs into account detail**

Update `src/components/accounts/AccountDetail.tsx` to import all tab components and render them by active tab index.

- [ ] **Step 8: Run checks**

Run:

```powershell
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```powershell
git add src/components/accounts
git commit -m "feat: add account entitlement tabs"
```

## Task 9: Add Import/Export Version 3

**Files:**

- Create: `electron/db/importExport.ts`
- Create: `electron/db/importExport.test.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Write import/export tests first**

Create `electron/db/importExport.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { createTempDatabase, TempDatabase } from '../test-utils/tempDb'
import { createAccount2, upsertEntitlement } from './accounts'
import { exportDatabaseJson, importDatabaseJson } from './importExport'
import { runMigrations } from './schema'

let temp: TempDatabase | null = null

afterEach(() => {
  temp?.cleanup()
  temp = null
})

describe('importExport v3', () => {
  it('exports and imports account 2 data', () => {
    temp = createTempDatabase()
    runMigrations(temp.db)

    const account = createAccount2(temp.db, {
      name: 'OpenAI Main',
      platformKey: 'openai',
      displayIdentifier: 'main@example.com',
    })
    upsertEntitlement(temp.db, {
      accountId: account.id,
      platformProfileId: account.platformProfileId,
      source: 'manual',
      planName: 'Plus',
    })

    const exported = exportDatabaseJson(temp.db)

    temp.cleanup()
    temp = createTempDatabase()
    runMigrations(temp.db)
    importDatabaseJson(temp.db, exported)

    const imported = temp.db.prepare("SELECT name FROM accounts WHERE name = 'OpenAI Main'").get() as any
    const entitlement = temp.db.prepare("SELECT plan_name FROM account_entitlements WHERE plan_name = 'Plus'").get() as any

    expect(imported.name).toBe('OpenAI Main')
    expect(entitlement.plan_name).toBe('Plus')
  })
})
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```powershell
npm test -- electron/db/importExport.test.ts
```

Expected: FAIL because `importExport.ts` does not exist.

- [ ] **Step 3: Implement import/export helpers**

Create `electron/db/importExport.ts` with:

- `const TABLES = [...]` listing all legacy and 2.0 tables.
- `exportDatabaseJson(db)` returning `{ version: 3, exportedAt, tables }`.
- `importDatabaseJson(db, data)` accepting version 3 and older version 2 backup shapes.
- private `clearTables(db)` and `insertRows(db, table, rows)` helpers.

Exported secret fields must remain encrypted as stored in SQLite.

- [ ] **Step 4: Update main import/export**

In `electron/main.ts`, import:

```ts
import { exportDatabaseJson, importDatabaseJson } from './db/importExport'
```

Fix both `.db` export/import paths to:

```ts
const dbPath = path.join(app.getPath('userData'), 'account-manager.db')
```

Replace manual JSON export with:

```ts
const data = exportDatabaseJson(db)
```

Replace manual JSON import transaction with:

```ts
const raw = fs.readFileSync(filePath, 'utf-8')
const data = JSON.parse(raw)
importDatabaseJson(db, data)
```

- [ ] **Step 5: Run checks**

Run:

```powershell
npm test -- electron/db/importExport.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add electron/db/importExport.ts electron/db/importExport.test.ts electron/main.ts
git commit -m "feat: add version 3 import export"
```

## Task 10: Add Connector Types and Registry

**Files:**

- Create: `electron/connectors/types.ts`
- Create: `electron/connectors/registry.ts`
- Create: `electron/ipc/connectors.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types/account2.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Create connector types**

Create `electron/connectors/types.ts`:

```ts
export interface ConnectorValidationInput {
  accountId: string
  platformProfileId?: string | null
  credentialId?: string
  secretValue?: string
  metadata?: Record<string, unknown>
}

export interface ConnectorValidationResult {
  ok: boolean
  status: 'connected' | 'limited' | 'invalid'
  message: string
  capabilities: Record<string, boolean>
  normalizedProfile?: Record<string, string>
}

export interface NormalizedUsageSnapshot {
  source: string
  metricKey: string
  metricLabel: string
  value: number
  unit: string
  periodStart?: string | null
  periodEnd?: string | null
  raw?: Record<string, unknown>
}

export interface NormalizedEntitlement {
  source: string
  planName?: string
  seatType?: string
  quotaLabel?: string
  quotaLimit?: number | null
  quotaUsed?: number | null
  quotaRemaining?: number | null
  quotaUnit?: string
  raw?: Record<string, unknown>
}

export interface ConnectorSyncResult {
  status: 'success' | 'limited' | 'failed'
  message: string
  usageSnapshots: NormalizedUsageSnapshot[]
  entitlements: NormalizedEntitlement[]
  capabilities: Record<string, boolean>
}

export interface PlatformConnector {
  platformKey: 'openai' | 'google'
  validate: (input: ConnectorValidationInput) => Promise<ConnectorValidationResult>
  sync: (input: ConnectorValidationInput) => Promise<ConnectorSyncResult>
}
```

- [ ] **Step 2: Create registry**

Create `electron/connectors/registry.ts`:

```ts
import { PlatformConnector } from './types'

const connectors = new Map<string, PlatformConnector>()

export function registerConnector(connector: PlatformConnector) {
  connectors.set(connector.platformKey, connector)
}

export function getConnector(platformKey: string) {
  const connector = connectors.get(platformKey)
  if (!connector) throw new Error(`Connector not registered: ${platformKey}`)
  return connector
}
```

- [ ] **Step 3: Create connector IPC**

Create `electron/ipc/connectors.ts`:

```ts
import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { getConnector } from '../connectors/registry'

export function registerConnectorIpc(_db: Database.Database) {
  ipcMain.handle('connectors:validate', async (_event, platformKey: string, input) => {
    return getConnector(platformKey).validate(input)
  })

  ipcMain.handle('connectors:sync', async (_event, platformKey: string, input) => {
    return getConnector(platformKey).sync(input)
  })
}
```

- [ ] **Step 4: Register connector IPC**

In `electron/main.ts`, add:

```ts
import { registerConnectorIpc } from './ipc/connectors'
```

Inside `registerIpcHandlers()`, after `registerAccount2Ipc(db)`, add:

```ts
  registerConnectorIpc(db)
```

- [ ] **Step 5: Expose connector methods in preload and renderer types**

In `electron/preload.ts`, add:

```ts
  validateConnector: (platformKey: string, data: any) => ipcRenderer.invoke('connectors:validate', platformKey, data),
  syncConnector: (platformKey: string, data: any) => ipcRenderer.invoke('connectors:sync', platformKey, data),
```

In `src/types/account2.ts`, add renderer `ConnectorValidationResult` and `ConnectorSyncResult` interfaces matching the Electron connector return shape.

In `src/types.ts`, add to `ElectronAPI`:

```ts
  validateConnector: (platformKey: string, data: any) => Promise<ConnectorValidationResult>
  syncConnector: (platformKey: string, data: any) => Promise<ConnectorSyncResult>
```

- [ ] **Step 6: Run checks**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add electron/connectors/types.ts electron/connectors/registry.ts electron/ipc/connectors.ts electron/main.ts electron/preload.ts src/types.ts src/types/account2.ts
git commit -m "feat: add connector registry"
```

## Task 11: Add OpenAI Connector

**Files:**

- Create: `electron/connectors/openai.ts`
- Create: `electron/connectors/openai.test.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Write mocked OpenAI connector tests**

Create `electron/connectors/openai.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOpenAIConnector } from './openai'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('openai connector', () => {
  it('validates an admin key and reports project capability', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ id: 'proj_123', name: 'Main' }] }),
    } as Response)))

    const connector = createOpenAIConnector()
    const result = await connector.validate({
      accountId: 'acc-1',
      secretValue: 'sk-admin-test',
      metadata: { keyType: 'admin' },
    })

    expect(result.ok).toBe(true)
    expect(result.capabilities.projects).toBe(true)
  })

  it('marks invalid keys without exposing the key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'invalid api key',
    } as Response)))

    const connector = createOpenAIConnector()
    const result = await connector.validate({
      accountId: 'acc-1',
      secretValue: 'sk-admin-secret-value',
      metadata: { keyType: 'admin' },
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe('invalid')
    expect(result.message).not.toContain('sk-admin-secret-value')
  })
})
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```powershell
npm test -- electron/connectors/openai.test.ts
```

Expected: FAIL because `openai.ts` does not exist.

- [ ] **Step 3: Implement OpenAI connector**

Create `electron/connectors/openai.ts`. It must:

- export `createOpenAIConnector()`
- validate Admin keys with `GET https://api.openai.com/v1/organization/projects?limit=1`
- validate ordinary API keys with `GET https://api.openai.com/v1/models`
- return `status: 'invalid'` for non-2xx responses without echoing the key
- sync projects with `GET https://api.openai.com/v1/organization/projects?limit=100`
- return an `openai_api` entitlement named `API Platform`

Use this request helper:

```ts
async function openAIGet(path: string, key: string) {
  return fetch(`https://api.openai.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  })
}
```

- [ ] **Step 4: Register OpenAI connector**

In `electron/main.ts`, add:

```ts
import { registerConnector } from './connectors/registry'
import { createOpenAIConnector } from './connectors/openai'
```

Before `app.whenReady().then(() => {`, add:

```ts
registerConnector(createOpenAIConnector())
```

- [ ] **Step 5: Run checks**

Run:

```powershell
npm test -- electron/connectors/openai.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add electron/connectors/openai.ts electron/connectors/openai.test.ts electron/main.ts
git commit -m "feat: add openai connector"
```

## Task 12: Add Google Connector Skeleton

**Files:**

- Create: `electron/connectors/google.ts`
- Create: `electron/connectors/google.test.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Write mocked Google connector tests**

Create `electron/connectors/google.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGoogleConnector } from './google'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('google connector', () => {
  it('validates an OAuth access token through userinfo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ email: 'user@gmail.com', name: 'User Name', sub: 'google-sub-1' }),
    } as Response)))

    const connector = createGoogleConnector()
    const result = await connector.validate({
      accountId: 'acc-1',
      secretValue: 'ya29.access-token',
      metadata: { tokenType: 'access_token' },
    })

    expect(result.ok).toBe(true)
    expect(result.normalizedProfile?.email).toBe('user@gmail.com')
    expect(result.capabilities.identity).toBe(true)
  })

  it('marks missing permission as limited', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 403,
      text: async () => 'permission denied',
    } as Response)))

    const connector = createGoogleConnector()
    const result = await connector.validate({
      accountId: 'acc-1',
      secretValue: 'ya29.access-token',
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe('limited')
  })
})
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```powershell
npm test -- electron/connectors/google.test.ts
```

Expected: FAIL because `google.ts` does not exist.

- [ ] **Step 3: Implement Google connector**

Create `electron/connectors/google.ts`. It must:

- export `createGoogleConnector()`
- validate OAuth access tokens through `GET https://openidconnect.googleapis.com/v1/userinfo`
- return normalized profile fields `email`, `name`, and `externalAccountId`
- return `status: 'limited'` for 403 responses
- return a `google_oauth` entitlement that makes consumer membership tracking manual-only

- [ ] **Step 4: Register Google connector**

In `electron/main.ts`, add:

```ts
import { createGoogleConnector } from './connectors/google'
```

After `registerConnector(createOpenAIConnector())`, add:

```ts
registerConnector(createGoogleConnector())
```

- [ ] **Step 5: Run checks**

Run:

```powershell
npm test -- electron/connectors/google.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add electron/connectors/google.ts electron/connectors/google.test.ts electron/main.ts
git commit -m "feat: add google connector"
```

## Task 13: Add Connector Dialogs

**Files:**

- Create: `src/components/connectors/OpenAIConnectorDialog.tsx`
- Create: `src/components/connectors/GoogleConnectorDialog.tsx`
- Modify: `src/components/accounts/AccountDetail.tsx`

- [ ] **Step 1: Create OpenAI connector dialog**

Create `OpenAIConnectorDialog.tsx`. It must:

- show a note that only OpenAI API Platform official APIs are supported
- accept Admin API Key or ordinary API Key
- call `window.electronAPI.validateConnector('openai', { accountId, platformProfileId, secretValue, metadata: { keyType } })`
- show the validation message without displaying the key

- [ ] **Step 2: Create Google connector dialog**

Create `GoogleConnectorDialog.tsx`. It must:

- show a note that Google One/Gemini consumer membership and family info remain manual
- accept an OAuth access token for the 2.0 foundation
- call `window.electronAPI.validateConnector('google', { accountId, platformProfileId, secretValue, metadata: { tokenType: 'access_token' } })`
- show the validation message without displaying the token

- [ ] **Step 3: Add connector button to account detail**

In `src/components/accounts/AccountDetail.tsx`, add a `连接平台` button in the header. Open `OpenAIConnectorDialog` when `account.platform_key === 'openai'`, open `GoogleConnectorDialog` when `account.platform_key === 'google'`, and hide the dialog for unsupported platforms.

- [ ] **Step 4: Run checks**

Run:

```powershell
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/components/connectors src/components/accounts/AccountDetail.tsx
git commit -m "feat: add connector dialogs"
```

## Task 14: Add Sync Persistence

**Files:**

- Modify: `electron/db/accounts.ts`
- Modify: `electron/ipc/connectors.ts`
- Modify: `src/stores/accountStore.ts`

- [ ] **Step 1: Add repository sync writer**

In `electron/db/accounts.ts`, add `writeConnectorSyncResult(db, input)`. It must:

- create or update a `connector_accounts` row
- insert a `connector_sync_runs` row
- write normalized entitlements through `upsertEntitlement`
- write normalized usage through `writeUsageSnapshot`
- update `account_platform_profiles.last_synced_at`
- set profile status to `sync_failed` when connector status is `failed`, otherwise `active`

Use a SQLite transaction and do not store secret values in sync logs.

- [ ] **Step 2: Persist connector sync results in IPC**

In `electron/ipc/connectors.ts`, import `writeConnectorSyncResult`, then update the sync handler:

```ts
  ipcMain.handle('connectors:sync', async (_event, platformKey: string, input) => {
    const result = await getConnector(platformKey).sync(input)
    writeConnectorSyncResult(db, {
      accountId: input.accountId,
      platformProfileId: input.platformProfileId,
      platformKey,
      status: result.status,
      message: result.message,
      capabilities: result.capabilities,
      usageSnapshots: result.usageSnapshots.map((snapshot) => ({
        ...snapshot,
        accountId: input.accountId,
        platformProfileId: input.platformProfileId,
      })),
      entitlements: result.entitlements.map((entitlement) => ({
        ...entitlement,
        accountId: input.accountId,
        platformProfileId: input.platformProfileId,
      })),
    })
    return result
  })
```

- [ ] **Step 3: Add sync action to account store**

In `src/stores/accountStore.ts`, add:

```ts
syncAccount: (platformKey: string, data: any) => Promise<void>
```

Implementation:

```ts
  syncAccount: async (platformKey, data) => {
    await window.electronAPI.syncConnector(platformKey, data)
    await get().loadAccounts()
  },
```

- [ ] **Step 4: Run checks**

Run:

```powershell
npm run typecheck
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add electron/db/accounts.ts electron/ipc/connectors.ts src/stores/accountStore.ts
git commit -m "feat: persist connector sync results"
```

## Task 15: Polish Version and Packaging

**Files:**

- Modify: `package.json`
- Optional modify: `README.md`

- [ ] **Step 1: Bump version**

Change `package.json`:

```json
"version": "2.0.0"
```

- [ ] **Step 2: Add README 2.0 notes**

Add a short section near the top of `README.md`:

```md
## AccountManager 2.0

- Platform-aware account management for OpenAI, Google, and other AI/developer accounts.
- Local AI entitlement and usage tracking.
- Official API/OAuth connector foundation for OpenAI and Google.
- Consumer subscription details without public APIs remain manual-only.
```

- [ ] **Step 3: Run final verification**

Run:

```powershell
npm test
npm run typecheck
npm run electron:build
```

Expected:

- `npm test`: PASS.
- `npm run typecheck`: PASS.
- `npm run electron:build`: PASS and creates `release\AccountManager Setup 2.0.0.exe` plus `release\win-unpacked\AccountManager.exe`.

- [ ] **Step 4: Create desktop shortcut**

Run:

```powershell
$target = (Resolve-Path -LiteralPath 'release\win-unpacked\AccountManager.exe').Path
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'AccountManager.lnk'
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = Split-Path -Parent $target
$shortcut.IconLocation = "$target,0"
$shortcut.Description = 'AccountManager'
$shortcut.Save()
```

- [ ] **Step 5: Verify package artifacts**

Run:

```powershell
Get-Item -LiteralPath 'release\AccountManager Setup 2.0.0.exe','release\win-unpacked\AccountManager.exe'
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'AccountManager.lnk'
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath
```

Expected:

- Installer exists at `release\AccountManager Setup 2.0.0.exe`.
- Unpacked executable exists at `release\win-unpacked\AccountManager.exe`.
- Desktop shortcut target equals the unpacked executable path.

- [ ] **Step 6: Commit**

Run:

```powershell
git add package.json package-lock.json README.md
git commit -m "chore: release account manager 2.0"
```

## Plan Self-Review

Spec coverage:

- Platform-aware accounts: Tasks 2, 4, 5, 6, and 7.
- Rich AI entitlement and usage data: Tasks 2, 4, 8, and 14.
- Secure local credential storage: Tasks 3 and 4.
- Official OpenAI connector: Tasks 11 and 14.
- Official Google connector foundation: Tasks 12 and 14.
- Manual-only consumer subscription boundary: Tasks 8 and 13.
- Import/export version 3: Task 9.
- Packaging and desktop shortcut: Task 15.

Unsupported scope is excluded:

- No cookie extraction.
- No browser profile import.
- No ChatGPT or Google consumer subscription scraping.
- No automatic scheduled sync.

Type consistency:

- Renderer `Account2Row`, IPC methods, and store methods use the same camelCase input and snake_case database output conventions.
- Connector normalized records map to repository entitlement and usage snapshot writers.
- Credential secrets are only written through `addCredential` and encrypted by `SecretStore`.
