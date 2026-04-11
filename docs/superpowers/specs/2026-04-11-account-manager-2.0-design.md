# AccountManager 2.0 Design

## Summary

AccountManager 2.0 upgrades the current local account vault into a platform-aware account and AI entitlement manager. It keeps the current offline-first SQLite storage and 2FA features, then adds platform classification, richer account metadata, AI entitlement tracking, usage snapshots, and official API/OAuth based connectors for OpenAI and Google.

The design intentionally avoids browser cookie extraction, session scraping, and undocumented member/subscription endpoints. External data is collected only through user-provided credentials, official OAuth consent, or documented platform APIs.

## Current Project Context

The current app is an Electron + React + Vite desktop app with local SQLite persistence through `better-sqlite3`. The core implementation is concentrated in these files:

- `electron/database.ts`: creates SQLite tables for folders, prompts, tags, accounts, custom fields, and TOTP accounts.
- `electron/main.ts`: registers all IPC handlers, database reads/writes, encryption/decryption, import/export, and window controls.
- `electron/preload.ts`: exposes IPC methods to the renderer.
- `src/stores/useStore.ts`: central Zustand store for accounts, prompts, TOTP, navigation, import/export.
- `src/components/AccountManager.tsx`: account list, account detail panel, sensitive field rendering, custom fields, and TOTP linking.

The existing account feature is a good base, but it is generic. It does not model platform type, official API connection state, AI quota, subscription details, team/family membership, sync history, or entitlement snapshots. The 2.0 work should also fix known schema drift: `account_custom_fields.sort_order` is queried/imported but not created by the current table definition, and import/export still has old `prompt-manager.db` path references.

## Goals

1. Let users manage many accounts by platform, especially Google and OpenAI accounts.
2. Store richer account information for AI-heavy accounts, including plan, entitlement, quota, usage, reset time, billing notes, family/team role, and member notes.
3. Support official connector sync for data that is available through documented APIs.
4. Keep all secrets local and encrypted.
5. Make sync results auditable: last sync time, source, success/failure, error reason, and raw capability summary.
6. Keep manual fields first-class because many consumer subscription details do not have public APIs.

## Non-Goals

1. Do not extract browser cookies, local browser sessions, or third-party app tokens.
2. Do not scrape ChatGPT, Google One, Gemini, or AI Studio web pages for subscription state.
3. Do not promise automatic retrieval of ChatGPT Plus/Pro personal subscription expiry, remaining message counts, Google One/Gemini Advanced membership, or consumer family group details.
4. Do not send account vault data to any cloud service owned by this app.
5. Do not redesign prompts or markdown management beyond the shared navigation and import/export changes needed for compatibility.

## External Capability Boundaries

### OpenAI

The OpenAI API Platform exposes organization/project resources, usage, costs, project rate limits, and API-key administration resources when the user provides the right Admin API key and permissions. AccountManager 2.0 can support:

- Validate an OpenAI API key or Admin API key.
- List OpenAI organization projects when an Admin API key is provided.
- Pull usage and cost snapshots for API Platform usage.
- Pull project rate limit information.
- Store redacted API-key metadata if the official endpoint only returns redacted key values.

AccountManager 2.0 should not claim it can read personal ChatGPT Plus/Pro subscription details, personal message caps, or consumer family membership automatically. Those fields are represented as manual entitlement records.

### Google

Google supports desktop OAuth, OpenID Connect profile/email data, People API profile data, Workspace Admin Directory for domain users when the signed-in account has admin privileges, Cloud Billing APIs, API Keys API, and quota/usage data through Google Cloud APIs such as Service Usage and Cloud Monitoring. AccountManager 2.0 can support:

- OAuth sign-in for a Google account and store refresh/access tokens locally.
- Fetch basic identity fields such as email, profile, and name.
- Fetch Workspace users for admin-authorized accounts.
- Fetch Google Cloud project API key metadata and key strings where permitted.
- Fetch quota limits and selected usage metrics where the user's Google Cloud project exposes them through supported APIs.

AccountManager 2.0 should not claim it can automatically read Google One, consumer Gemini Advanced / AI Pro membership state, consumer family group members, or exact AI Studio quota tier from a universal API. Those fields remain manual unless an official API becomes available.

## Recommended 2.0 Scope

The first 2.0 release should include:

1. Platform-aware account management.
2. OpenAI and Google account templates.
3. Local AI entitlement, quota, reset, and expiry tracking.
4. OpenAI API Platform connector.
5. Google OAuth identity connector.
6. Google Cloud/API Keys connector for accounts with the required permissions.
7. Secure local storage and sync audit logs.

The first 2.0 release should not include web automation, browser profile import, cookie extraction, or consumer subscription scraping.

## Data Model

### `schema_migrations`

Tracks database migration version and execution time.

Fields:

- `version TEXT PRIMARY KEY`
- `applied_at TEXT NOT NULL`

### `platforms`

Stores built-in and user-created platform definitions.

Fields:

- `id TEXT PRIMARY KEY`
- `key TEXT NOT NULL UNIQUE`
- `name TEXT NOT NULL`
- `category TEXT NOT NULL`
- `icon TEXT DEFAULT ''`
- `color TEXT DEFAULT ''`
- `is_builtin INTEGER DEFAULT 0`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Built-in platform keys for 2.0:

- `openai`
- `google`
- `anthropic`
- `microsoft`
- `github`
- `generic_ai`
- `generic`

### `account_platform_profiles`

Adds platform-specific metadata to existing `accounts` without replacing the current table immediately.

Fields:

- `id TEXT PRIMARY KEY`
- `account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE`
- `platform_id TEXT NOT NULL REFERENCES platforms(id)`
- `display_identifier TEXT DEFAULT ''`
- `external_account_id TEXT DEFAULT ''`
- `organization_id TEXT DEFAULT ''`
- `project_id TEXT DEFAULT ''`
- `workspace_id TEXT DEFAULT ''`
- `role TEXT DEFAULT ''`
- `status TEXT DEFAULT 'active'`
- `last_synced_at TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

### `account_credentials`

Stores API keys, OAuth tokens, recovery codes, client IDs, and other platform credentials. Secret values are encrypted at rest.

Fields:

- `id TEXT PRIMARY KEY`
- `account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE`
- `platform_profile_id TEXT REFERENCES account_platform_profiles(id) ON DELETE CASCADE`
- `kind TEXT NOT NULL`
- `label TEXT NOT NULL`
- `secret_value TEXT DEFAULT ''`
- `public_hint TEXT DEFAULT ''`
- `metadata_json TEXT DEFAULT '{}'`
- `expires_at TEXT`
- `last_validated_at TEXT`
- `validation_status TEXT DEFAULT 'unknown'`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Credential `kind` values:

- `password`
- `totp_secret`
- `api_key`
- `openai_admin_key`
- `oauth_refresh_token`
- `oauth_access_token`
- `google_client_secret`
- `recovery_code`
- `other_secret`

### `account_entitlements`

Stores subscription and entitlement information, both manual and synced.

Fields:

- `id TEXT PRIMARY KEY`
- `account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE`
- `platform_profile_id TEXT REFERENCES account_platform_profiles(id) ON DELETE CASCADE`
- `source TEXT NOT NULL`
- `plan_name TEXT DEFAULT ''`
- `seat_type TEXT DEFAULT ''`
- `billing_cycle TEXT DEFAULT ''`
- `started_at TEXT`
- `expires_at TEXT`
- `renews_at TEXT`
- `quota_label TEXT DEFAULT ''`
- `quota_limit REAL`
- `quota_used REAL`
- `quota_remaining REAL`
- `quota_unit TEXT DEFAULT ''`
- `resets_at TEXT`
- `is_family_member INTEGER DEFAULT 0`
- `family_role TEXT DEFAULT ''`
- `team_role TEXT DEFAULT ''`
- `notes TEXT DEFAULT ''`
- `raw_json TEXT DEFAULT '{}'`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

`source` values:

- `manual`
- `openai_api`
- `google_oauth`
- `google_cloud`
- `imported`

### `usage_snapshots`

Stores time-series usage/cost/quota snapshots.

Fields:

- `id TEXT PRIMARY KEY`
- `account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE`
- `platform_profile_id TEXT REFERENCES account_platform_profiles(id) ON DELETE CASCADE`
- `source TEXT NOT NULL`
- `metric_key TEXT NOT NULL`
- `metric_label TEXT NOT NULL`
- `value REAL NOT NULL`
- `unit TEXT NOT NULL`
- `period_start TEXT`
- `period_end TEXT`
- `captured_at TEXT NOT NULL`
- `raw_json TEXT DEFAULT '{}'`

Examples:

- `openai.cost.usd`
- `openai.tokens.input`
- `openai.tokens.output`
- `openai.requests`
- `google.quota.limit`
- `google.quota.usage`
- `manual.messages.remaining`

### `connector_accounts`

Stores connector authorization records and capability summaries.

Fields:

- `id TEXT PRIMARY KEY`
- `account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE`
- `platform_key TEXT NOT NULL`
- `auth_type TEXT NOT NULL`
- `credential_id TEXT REFERENCES account_credentials(id)`
- `scopes_json TEXT DEFAULT '[]'`
- `capabilities_json TEXT DEFAULT '{}'`
- `status TEXT DEFAULT 'disconnected'`
- `last_synced_at TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

### `connector_sync_runs`

Stores sync attempts.

Fields:

- `id TEXT PRIMARY KEY`
- `connector_account_id TEXT NOT NULL REFERENCES connector_accounts(id) ON DELETE CASCADE`
- `started_at TEXT NOT NULL`
- `finished_at TEXT`
- `status TEXT NOT NULL`
- `error_code TEXT DEFAULT ''`
- `error_message TEXT DEFAULT ''`
- `summary_json TEXT DEFAULT '{}'`

### `audit_events`

Stores local security and data-changing events without secret values.

Fields:

- `id TEXT PRIMARY KEY`
- `event_type TEXT NOT NULL`
- `account_id TEXT`
- `platform_key TEXT DEFAULT ''`
- `message TEXT NOT NULL`
- `metadata_json TEXT DEFAULT '{}'`
- `created_at TEXT NOT NULL`

## Security Design

The 2.0 release should introduce a `SecretStore` layer in the Electron main process. Renderer code never receives encrypted database blobs or raw refresh tokens unless the user explicitly clicks reveal/copy for a specific credential.

Minimum 2.0 implementation:

- Continue AES-256-GCM encryption but centralize it behind `SecretStore`.
- Add a vault key version to encrypted values.
- Never log raw `secret_value`, OAuth tokens, passwords, TOTP secrets, recovery codes, or full API keys.
- Show API key hints using prefixes/suffixes only.
- Export backups with encrypted secret fields as stored, not decrypted plaintext.

Recommended 2.1 hardening:

- Add optional master password or Windows Credential Manager key wrapping.
- Add an auto-lock timer.
- Add per-field reveal audit events.

## Backend Architecture

`electron/main.ts` should be split because 2.0 adds enough surface area that one IPC file will become fragile.

Recommended new modules:

- `electron/db/schema.ts`: table creation and migrations.
- `electron/db/accounts.ts`: account CRUD, platform profiles, credentials, entitlements.
- `electron/db/importExport.ts`: versioned JSON and SQLite import/export.
- `electron/security/secretStore.ts`: encryption, redaction, reveal/copy helpers.
- `electron/connectors/types.ts`: connector interfaces and result types.
- `electron/connectors/openai.ts`: OpenAI API Platform connector.
- `electron/connectors/google.ts`: Google OAuth and Google Cloud connector.
- `electron/connectors/registry.ts`: connector lookup and sync orchestration.
- `electron/ipc/accounts.ts`: account-related IPC handlers.
- `electron/ipc/connectors.ts`: connector IPC handlers.
- `electron/ipc/index.ts`: registers all IPC modules.

Connector interface:

```ts
export interface PlatformConnector {
  platformKey: 'openai' | 'google'
  validate(input: ConnectorValidationInput): Promise<ConnectorValidationResult>
  sync(connectorAccountId: string): Promise<ConnectorSyncResult>
  disconnect(connectorAccountId: string): Promise<void>
}
```

The connector result must return normalized records:

- profile updates
- credentials metadata updates
- entitlement records
- usage snapshots
- audit events
- sync summary

## Renderer Architecture

The renderer should keep Zustand, but account management should be split into smaller components.

Recommended files:

- `src/types/account2.ts`: platform, credential, entitlement, usage, connector types.
- `src/stores/accountStore.ts`: account list, platform filters, account detail, sync actions.
- `src/components/accounts/AccountManager2.tsx`: shell layout.
- `src/components/accounts/AccountList.tsx`: filterable list.
- `src/components/accounts/AccountDetail.tsx`: tab container.
- `src/components/accounts/tabs/BasicInfoTab.tsx`
- `src/components/accounts/tabs/CredentialsTab.tsx`
- `src/components/accounts/tabs/EntitlementsTab.tsx`
- `src/components/accounts/tabs/UsageTab.tsx`
- `src/components/accounts/tabs/FamilyTeamTab.tsx`
- `src/components/accounts/tabs/SyncLogTab.tsx`
- `src/components/accounts/PlatformTemplateDialog.tsx`
- `src/components/connectors/OpenAIConnectorDialog.tsx`
- `src/components/connectors/GoogleConnectorDialog.tsx`

The old `AccountManager.tsx` can be replaced after feature parity is covered.

## User Experience

### Account List

The account list supports:

- Platform filters: All, Google, OpenAI, AI Platforms, Cloud/API, Other.
- Search across name, username, platform identifier, organization, project, and notes.
- Badges for 2FA, API key, OAuth connected, entitlement expiring soon, sync failed.
- Sorting by updated time, platform, expiry date, and usage reset time.

### Account Detail

The detail panel uses tabs:

1. Basic Info: name, platform, login identifier, password, phone, backup email, notes.
2. Credentials: password, TOTP, API keys, OAuth status, recovery codes, custom secret fields.
3. AI Entitlements: plan, seat type, quota, remaining amount, reset time, expiry, billing notes.
4. Usage: latest snapshots and simple historical list.
5. Family/Team: manual family role, team role, member notes, Workspace members when available.
6. Sync Log: last sync, source, success/failure, error messages.

### Platform Templates

Creating an account asks for a platform template.

OpenAI template fields:

- login email
- password
- TOTP
- OpenAI API key
- OpenAI Admin key
- organization ID
- project ID
- plan name
- manual ChatGPT entitlement fields

Google template fields:

- Gmail address
- password
- TOTP
- recovery email
- recovery phone
- OAuth connection
- Google Cloud project ID
- API key
- Workspace role
- manual Google One/Gemini entitlement fields

Generic AI template fields:

- login identifier
- password
- API key
- plan
- quota
- reset time
- expiry

## Sync Behavior

Sync is manual in 2.0. Automatic scheduled sync can be added later after the manual flow is stable.

Sync flow:

1. User opens connector dialog.
2. User provides Admin API key, API key, or OAuth authorization.
3. App validates permissions.
4. App stores credential through `SecretStore`.
5. App creates or updates `connector_accounts`.
6. User clicks "Sync now".
7. Main process connector fetches supported data.
8. App writes normalized profile, entitlement, usage, and sync log records.
9. UI shows fresh data and unsupported fields remain manual.

Failure handling:

- Invalid key: mark credential `validation_status = 'invalid'`.
- Missing permission: mark connector status `limited` and show missing capability.
- Expired OAuth token: mark connector status `reauthorization_required`.
- Network failure: keep previous snapshots and write failed sync run.
- Unsupported consumer subscription data: show "Manual only" reason instead of error.

## Import/Export

JSON export version should become version 3 for the 2.0 schema. Exported secret values remain encrypted. Import should accept older backups and map missing 2.0 fields to defaults.

Migration rules:

1. Existing `accounts` rows remain valid.
2. Existing custom fields remain valid.
3. Existing TOTP links remain valid.
4. Existing accounts get a generic platform profile if no platform is known.
5. If account name or notes indicate OpenAI or Google, the migration may suggest a platform but should not auto-convert silently.
6. Add missing `account_custom_fields.sort_order` column.
7. Fix import/export database path to `account-manager.db`.

## Testing Strategy

### Unit and Integration Tests

Add tests around:

- Schema migration from the current database shape.
- Secret encryption/decryption and redaction.
- Account CRUD with platform profiles.
- Credential CRUD without leaking plaintext.
- Entitlement CRUD and usage snapshots.
- Import/export version 2 to version 3 compatibility.
- OpenAI connector normalization using mocked HTTP responses.
- Google connector normalization using mocked HTTP responses.

### Manual Verification

Before a 2.0 exe build:

1. Start with a fresh database.
2. Start with an existing 1.0 database.
3. Create OpenAI, Google, and generic accounts.
4. Add manual entitlements and usage.
5. Validate an invalid API key and confirm safe failure.
6. Run mocked or real OpenAI sync with a test account.
7. Run Google OAuth with a test Google account.
8. Export backup and re-import into a fresh profile.
9. Build with `npm run electron:build`.

## Implementation Phases

### Phase 1: Schema and Safety Foundation

- Add versioned migrations.
- Add platform, profile, credential, entitlement, usage, connector, sync, and audit tables.
- Add `SecretStore`.
- Fix import/export path and custom field sort order.
- Keep old UI working against migrated data.

### Phase 2: Platform-Aware Account UI

- Split `AccountManager.tsx`.
- Add platform filters and templates.
- Add credential, entitlement, usage, family/team, and sync-log tabs.
- Add manual AI entitlement and usage editing.

### Phase 3: OpenAI Connector

- Add Admin/API key storage and validation.
- Sync organization projects, usage/cost snapshots, and rate limits where permissions allow.
- Store unsupported ChatGPT consumer subscription details as manual fields only.

### Phase 4: Google Connector

- Add OAuth desktop flow.
- Sync basic identity.
- Add optional Workspace Admin and Google Cloud/API Keys sync for accounts with the required permissions.
- Store unsupported Google One/Gemini consumer membership details as manual fields only.

### Phase 5: Polish and Packaging

- Add failure-state UI.
- Add backup compatibility checks.
- Add focused tests.
- Build 2.0 exe and create desktop shortcut.

## Acceptance Criteria

1. Existing 1.0 account, prompt, folder, tag, and TOTP data survives migration.
2. User can classify accounts by platform.
3. User can create OpenAI and Google accounts from templates.
4. User can record AI plan, expiry, reset time, quota, used amount, remaining amount, and notes manually.
5. User can store and reveal/copy credentials intentionally, with redacted list display.
6. OpenAI connector can sync documented API Platform data when provided valid credentials.
7. Google connector can sync documented identity and cloud/API-key data when provided valid authorization.
8. Unsupported consumer subscription/family data is clearly labeled manual-only.
9. Import/export preserves 2.0 data.
10. `npm run electron:build` succeeds after implementation.

## Open Decisions For Implementation Planning

1. Whether 2.0 should require a master password immediately or defer it to 2.1.
2. Whether OAuth client configuration is user-provided or bundled as a developer-owned app registration.
3. Whether OpenAI and Google real API sync tests should be manual-only or support optional environment variables.
4. Whether account folders should be shared with prompts or split into account-specific groups.

Recommended defaults:

1. Defer required master password to 2.1, but build `SecretStore` so it can support key versioning.
2. Use user-provided Google OAuth client config for local/private builds.
3. Use mocked connector tests by default, optional real API checks through environment variables.
4. Keep existing folders for prompts, add platform filters for accounts first, and postpone account-specific folder trees unless users still need them after 2.0.
