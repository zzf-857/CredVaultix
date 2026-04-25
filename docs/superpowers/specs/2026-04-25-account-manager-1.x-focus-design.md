# AccountManager 1.x Focus Design

## Summary

AccountManager 1.x is a local desktop account vault focused on three things only:

1. Managing `Google` and `Microsoft` primary accounts
2. Marking which platforms those accounts are used to sign into by using tags
3. Managing `2FA` secrets and codes, with strong linkage back to the owning account

The app should stop presenting itself as a general-purpose toolkit. `Prompt` management, folder trees, and the random address generator are out of scope for the focused 1.x product.

## Product Boundary

### In Scope

- Local account records
- Account platform type: `google`, `microsoft`, `other`
- Global reusable tags, primarily used to record third-party platforms such as `Notion`, `Discord`, `Figma`, `GitHub`
- Independent `2FA` panel with account linkage
- Account recycle bin
- Local import/export
- CSV import for legacy account data

### Out of Scope

- Prompt management
- Prompt folders
- Prompt tags
- Markdown editor workflows
- Address / identity generator
- OAuth connectors
- Platform entitlement tracking
- Cloud sync
- Browser scraping

## User Model

### Primary Use Cases

- Save a Google account with email, password, backup info, notes, custom fields, and `2FA`
- Save a Microsoft account with the same core fields
- Record which external platforms are registered with that Google or Microsoft account by attaching tags
- View all `2FA` codes in one place and jump back to the related account

### Platform Semantics

- New accounts must be created as either `Google` or `Microsoft`
- Existing legacy accounts without a known platform are preserved as `Other`
- `Other` exists only for compatibility and migration safety; the product focus is still Google and Microsoft

## Data Model

### Accounts

Add a `platform` column to the `accounts` table.

Allowed values:

- `google`
- `microsoft`
- `other`

Rules:

- Existing rows migrate to `other`
- New accounts default to `google` unless the user explicitly chooses `microsoft`
- The account list can filter by platform

### Tags

Keep tags global and reusable.

Add a new `account_tags` join table:

- `account_id`
- `tag_id`

Rules:

- Tags apply to accounts, not prompts
- Tags remain global so the same platform tag can be reused across many Google or Microsoft accounts
- UI should support quick-add of common platform tags, but tags remain free-form

### TOTP

Keep the existing standalone `totp_accounts` table and independent panel.

Rules:

- `2FA` entries can link back to an account
- Deleting an account should preserve linked `2FA` records as orphaned warning entries
- From the `2FA` panel, a linked entry should jump back to the owning account

## UX Structure

### Sidebar

The sidebar should only contain:

- `账号管理`
- `2FA 验证器`
- `废纸篓`

Prompt, folder, tag navigation, and address generation should be removed from the primary product navigation.

### Account Workspace

The account view should become the product home.

Required elements:

- Platform filter chips or tabs: `全部`, `Google`, `Microsoft`, `Other`
- Search box
- Create account action
- CSV import action
- Account cards/list rows showing platform, key identity field, and attached tags

### Account Detail

The detail view should emphasize:

- Platform
- Core credentials
- Backup info
- Notes
- Tags representing registered platforms
- Custom fields
- Linked `2FA`

Suggested tags should appear as a convenience strip, especially for common platform names, but the user can still create arbitrary tags.

## Migration and Compatibility

- Do not delete legacy prompt tables from SQLite in this pass; removing UI and data flow is enough
- Do remove prompt-related renderer/store usage so the focused app no longer exposes those features
- Import/export should continue to include account, custom field, `2FA`, and account-tag data
- Legacy prompt import/export compatibility can remain, but product copy should stop advertising prompt features

## Error Handling

- If platform is missing or invalid during migration, normalize to `other`
- If tag assignment references a missing tag, ignore the link safely
- If a linked account is deleted, keep the `2FA` record and mark it orphaned

## Testing Strategy

Focus tests on behavior that is easy to regress:

- Platform normalization and label helpers
- Suggested-tag behavior
- Account tag serialization / filtering helpers
- Type-safe build verification for renderer and Electron code paths

## Success Criteria

The product is considered focused enough for 1.x when:

- There is no Prompt or address-generator navigation in the app
- Users can create Google and Microsoft accounts explicitly
- Users can assign reusable tags to accounts to represent registered platforms
- The `2FA` panel remains first-class and linked to accounts
- The app still builds successfully after the scope reduction
