# Service Info Vault and Desktop UX Upgrade Design

## Summary

CredVaultix will evolve from a focused local account manager into a local account and service information vault. The new module is not an API key template library. It is a fully custom service information area where users can record any vendor, service, server, MCP endpoint, financial account detail, cloud credential, app id, secret key, note, or operational field that needs to be stored locally.

The existing account, tag, custom field, recycle bin, and 2FA data remains the first priority. This upgrade must preserve existing SQLite data before adding new capability.

## Non-Negotiable Constraints

- Existing user data is more important than the upgrade.
- Every data migration must create an automatic database backup before new schema changes run.
- Migrations may add tables, columns, indexes, and compatibility helpers, but must not delete existing tables or rewrite existing account, 2FA, tag, account custom field, or account tag data.
- After migration, the app must verify that existing core table counts did not decrease.
- If backup or migration safety checks fail, the app must not continue with destructive follow-up operations.
- Every small working slice must be committed separately with a Chinese git commit message.
- Existing untracked backup or diff files in the workspace must not be staged or modified unless the user explicitly asks.

## Product Model

### Main Concept

The new area is named `服务信息` in the UI. It can still contain API keys, but the wording must not imply that only API keys are allowed.

Examples of service records:

- `腾讯云 API`
- `阿里云服务器信息`
- `OpenAI 生产环境`
- `本地 MCP 服务`
- `银行卡网银资料`
- `某个客户项目的回调配置`

Each service record belongs to zero or one outer group. A service without a group remains visible as an ungrouped item, similar to a Chrome tab that is not inside a tab group.

### Outer Groups

Outer groups organize services. Examples:

- `服务器类`
- `MCP 类`
- `金融类`
- `云厂商类`
- `AI 平台类`

Outer group behavior follows a Chrome-like tab group model:

- Create a group.
- Rename a group.
- Delete a group.
- Collapse or expand a group.
- Reorder groups.
- Drag a service into a group.
- Drag a service out of a group.
- Drag a service from one group to another.
- Reorder services inside a group.
- Multi-select services and create a new group from the selection.
- Multi-select services and move them into an existing group.
- Multi-select services and move them out to ungrouped.

Deleting an outer group must not delete its services. Its services move to ungrouped, preserving their data.

### Service Fields

Each service contains free-form fields. There are no built-in vendor templates and no fixed field names.

Users can create fields such as:

- `SecretId`
- `SecretKey`
- `AppId`
- `Endpoint`
- `SSH Host`
- `端口`
- `用户名`
- `私钥路径`
- `回调地址`
- `备注`

Every field has:

- Custom display name.
- Value.
- Sensitive flag.
- Sort order.
- Optional inner field group.

Sensitive fields are encrypted at rest, hidden by default, and copyable with a one-click action. Non-sensitive fields can be shown directly.

### Inner Field Groups

Each service can organize its fields into inner groups. Examples:

- `基础信息`
- `访问密钥`
- `服务器登录`
- `回调配置`
- `备注资料`

Inner field group behavior mirrors outer group behavior:

- Create a field group.
- Rename a field group.
- Delete a field group.
- Collapse or expand a field group.
- Reorder field groups.
- Drag fields into a group.
- Drag fields out of a group.
- Drag fields between groups.
- Reorder fields inside a group.
- Multi-select fields and create a new field group from the selection.
- Multi-select fields and move them into an existing field group.
- Multi-select fields and move them out to ungrouped.

Deleting an inner field group must not delete its fields. Its fields move to the service's ungrouped field area.

## Data Model

The implementation should add new tables for service information instead of overloading existing account custom fields.

### `secret_groups`

Stores outer service groups.

- `id TEXT PRIMARY KEY`
- `name TEXT NOT NULL`
- `color TEXT DEFAULT '#a8c7fa'`
- `sort_order INTEGER DEFAULT 0`
- `is_collapsed INTEGER DEFAULT 0`
- `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
- `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`

### `secret_services`

Stores services or vendors.

- `id TEXT PRIMARY KEY`
- `group_id TEXT DEFAULT NULL REFERENCES secret_groups(id) ON DELETE SET NULL`
- `linked_account_id TEXT DEFAULT NULL REFERENCES accounts(id) ON DELETE SET NULL`
- `name TEXT NOT NULL`
- `description TEXT DEFAULT ''`
- `url TEXT DEFAULT ''`
- `notes TEXT DEFAULT ''`
- `is_favorite INTEGER DEFAULT 0`
- `is_deleted INTEGER DEFAULT 0`
- `deleted_at DATETIME DEFAULT NULL`
- `sort_order INTEGER DEFAULT 0`
- `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
- `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`

### `secret_field_groups`

Stores field groups inside a service.

- `id TEXT PRIMARY KEY`
- `service_id TEXT NOT NULL REFERENCES secret_services(id) ON DELETE CASCADE`
- `name TEXT NOT NULL`
- `color TEXT DEFAULT '#a8c7fa'`
- `sort_order INTEGER DEFAULT 0`
- `is_collapsed INTEGER DEFAULT 0`
- `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
- `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`

### `secret_fields`

Stores individual service fields.

- `id TEXT PRIMARY KEY`
- `service_id TEXT NOT NULL REFERENCES secret_services(id) ON DELETE CASCADE`
- `group_id TEXT DEFAULT NULL REFERENCES secret_field_groups(id) ON DELETE SET NULL`
- `field_name TEXT NOT NULL`
- `field_value TEXT DEFAULT ''`
- `is_secret INTEGER DEFAULT 1`
- `sort_order INTEGER DEFAULT 0`
- `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
- `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`

When `is_secret = 1`, `field_value` must be encrypted with the existing encryption helper before persistence and decrypted only through the Electron IPC layer for renderer display.

## Data Safety and Migration

### Backup Before Migration

Before adding the new service information schema, the main process must copy the current `account-manager.db` to a timestamped backup path under the app user data directory. The backup file name should include the date and time, such as `account-manager-before-service-vault-2026-07-01-183000.db`.

If the current database does not exist yet, backup can be skipped because there is no existing user data to protect.

If the database exists and backup fails, the new migration must stop. The app should surface a clear error that the upgrade could not continue because the data backup failed.

### Count Verification

Before migration, record counts for existing core tables when they exist:

- `accounts`
- `totp_accounts`
- `tags`
- `account_custom_fields`
- `account_tags`

After migration, query those counts again. The after count must be greater than or equal to the before count for each table. A lower count means the migration is unsafe and must report an error.

### Import and Export

JSON database export must include:

- Existing account and 2FA data.
- `secret_groups`
- `secret_services`
- `secret_field_groups`
- `secret_fields`

JSON import must remain compatible with old backup files that do not contain these new arrays. Missing service information arrays import as empty sets.

SQLite `.db` import remains a full database replacement, followed by normal migrations and backup safety.

## UI Structure

### Sidebar

The sidebar becomes a stable app navigation surface:

- `账号管理`
- `服务信息`
- `2FA 验证器`
- `废纸篓`

It follows the desktop app standards:

- Resizable by dragging its edge.
- One-click collapse and expand.
- Dragging below the collapse threshold collapses it.
- Expanded width persists through the unified preference service.

### Service Information Workspace

The service information workspace uses a left list and right detail layout, consistent with the current account manager shape but cleaner and more modular.

List header:

- Search box with instant fuzzy filtering and a clear action.
- Sort menu for manual order, name A-Z, name Z-A, latest updated, oldest updated, favorites first, and random.
- Add service button.
- Batch action area that appears when items are selected.

List content:

- Ungrouped service area.
- Collapsible service groups.
- Service rows or compact cards that show service name, optional description, linked account indicator, favorite marker, and small count of fields.
- Empty states for no services and no search results.

Detail header:

- Service name.
- Description or purpose.
- Optional URL.
- Optional linked account.
- Favorite action.
- Edit, delete, and copy-focused actions.

Detail body:

- Ungrouped fields.
- Collapsible field groups.
- Field rows with name, masked value for sensitive fields, reveal action, copy action, edit action, delete action, and drag handle.
- Batch action area that appears when fields are selected.

### Drag and Multi-Select Behavior

Drag and drop should persist `group_id` and `sort_order` atomically through IPC actions. The renderer should not write local storage for service grouping or ordering.

Selection behavior:

- Single click selects a service or field.
- Checkbox or modifier-click supports multi-select.
- Batch toolbar supports grouping, moving, and deleting.
- Context menus can expose the same operations as buttons.

Keyboard details can be added later, but the first implementation must keep mouse workflows complete.

## Desktop UX Upgrade

The existing app should feel more like a restrained desktop management tool.

Changes should stay focused on surfaces touched by the new module and shared shell:

- Replace scattered `localStorage` usage with a small preference service exposed through IPC or a centralized renderer service.
- Store sidebar width, sidebar collapsed state, account list width, 2FA card alignment, and service list preferences through that service.
- Add an `打开数据目录` action so the user can locate the local database and backup folder.
- Keep cards at modest radius and reduce overly decorative glass, heavy shadow, and oversized rounded controls where they interfere with a professional tool feel.
- Keep dense, scannable layouts for account, service, and 2FA management.
- Avoid unrelated redesigns that do not support the service information module or desktop standards.

## Architecture

### Electron Main Process

Responsibilities:

- Database backup before schema migration.
- Schema creation and migration verification.
- Service information CRUD IPC handlers.
- Grouping and sort-order IPC handlers.
- Import and export support for service information.
- Data directory open action.

### Renderer Store

Extend Zustand with a service information slice:

- Groups.
- Services.
- Selected service id.
- Service search query.
- Service sort mode.
- Selected service ids for batch actions.
- Selected field ids for detail batch actions.
- Load, create, update, delete, restore, group, ungroup, and reorder actions.

### Renderer Components

Create focused service information components rather than growing `AccountManager.tsx`.

Expected component boundaries:

- `ServiceInfoManager`
- `ServiceGroupList`
- `ServiceListItem`
- `ServiceDetail`
- `ServiceFieldGroup`
- `ServiceFieldRow`
- `BatchActionBar`
- Shared resizable shell helpers where useful

## Error Handling

- Empty service name is rejected before save.
- Empty field name is rejected before save.
- Deleting a service should use a soft-delete flow, matching the existing account safety posture.
- Deleting a group never deletes contained services or fields.
- Failed copy actions should not mutate data and should display a non-blocking message.
- Invalid linked account ids should be normalized to `NULL`.
- IPC handlers must validate ids and return clear errors rather than silently corrupting sort order.

## Testing Strategy

Focus tests on behavior that protects data and grouping correctness:

- Migration creates the new tables without reducing existing table counts.
- Backup helper chooses the correct backup path and refuses to continue when copying an existing database fails.
- Service grouping helpers move services into, between, and out of groups while preserving service ids.
- Field grouping helpers move fields into, between, and out of field groups while preserving field ids.
- Deleting outer groups ungroups services rather than deleting them.
- Deleting inner field groups ungroups fields rather than deleting them.
- Export includes service information arrays.
- Import accepts old backups without service information arrays.
- Sensitive fields are encrypted before persistence and decrypted for detail display.
- Typecheck and build remain green.

## Incremental Commit Plan

Each slice must leave the repo in a coherent state and be committed with a Chinese commit message.

1. `docs: 编写服务信息库与桌面体验升级设计`
2. `chore: 新增数据库升级前自动备份`
3. `feat: 新增服务信息数据表迁移`
4. `feat: 增加服务信息 IPC 接口`
5. `feat: 增加服务信息状态管理`
6. `feat: 增加服务信息列表与分组界面`
7. `feat: 增加服务详情字段与字段分组界面`
8. `refactor: 统一桌面偏好存储`
9. `refactor: 优化侧栏折叠和桌面布局`
10. `style: 收敛桌面管理工具视觉规范`
11. `test: 补充服务信息与迁移保护测试`

## Success Criteria

The work is complete when:

- Existing account, 2FA, tag, and custom field data survives the upgrade with an automatic backup.
- The app has a first-class `服务信息` module.
- Users can create custom service records without choosing an internal template.
- Users can add, edit, delete, and reorder custom fields with arbitrary names.
- Users can group, ungroup, drag, reorder, multi-select, and rename service groups.
- Users can group, ungroup, drag, reorder, multi-select, and rename field groups inside a service.
- Sensitive fields are encrypted at rest, hidden by default, and copyable.
- Import and export include the new service information data while staying compatible with old backups.
- The shell follows the relevant desktop app standards for resizable/collapsible sidebar, search, sorting, empty states, preference storage, and data directory access.
- The full verification suite for the touched areas passes.
