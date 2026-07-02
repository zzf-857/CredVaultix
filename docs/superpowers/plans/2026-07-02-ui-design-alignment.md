# CredVaultix UI Design Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the existing CredVaultix desktop UI with the HTML designs in `F:\AI\AIMadeupTools\01_DesktopApps\CredVaultix\New设计` without adding design-only features or changing stored user data.

**Architecture:** Keep the current React, MUI, Zustand, Electron IPC, and SQLite-backed data flow intact. Restrict changes to visual styling and component layout in the renderer; do not modify schemas, migrations, IPC method contracts, or import/export behavior.

**Tech Stack:** React 18, TypeScript, MUI 5, Zustand, Vite, Electron.

---

## File Structure

- Modify `src/theme/index.ts`: define the design-token-aligned dark/light palettes and MUI component defaults for buttons, fields, dialogs, menus, chips, and list items.
- Modify `src/index.css`: tune global scrollbars, font smoothing, focus behavior, and app-level utility classes only.
- Modify `src/App.tsx`: adjust default sidebar sizing to the design reference while preserving saved preferences.
- Modify `src/components/TitleBar.tsx`: align the 48px top bar, brand treatment, and existing import/export/theme/window controls.
- Modify `src/components/Sidebar.tsx`: align navigation density, active left border, collapsed state, and bottom data-directory action.
- Modify `src/components/common/ResizableSidebar.tsx`: align collapsed width and resize affordance.
- Modify `src/components/AccountManager.tsx`: align the current account list/detail UI with the design panes, field boxes, and dialog treatment.
- Modify `src/components/service-info/*.tsx`: align the current service/group/field UI, batch bars, and dialogs with the design panes while preserving custom grouping and custom fields.
- Modify `src/components/TwoFactorPanel.tsx`: align existing TOTP/HOTP cards and dialogs, without adding account-provider integrations.
- Modify `src/components/TrashManager.tsx`: align existing recycle-bin list and destructive confirmation UI.

## Non-Negotiable Boundaries

- Do not add Google OAuth, Google One, avatar sync, subscription status, security score, activity logs, cloud sync, analytics, or settings screens.
- Do not add built-in service/vendor templates.
- Do not change database schema, migrations, or existing data import/export logic.
- Do not stage files from the main worktree such as backups, diff files, or the `New设计` HTML files.
- Keep every runnable slice committed with a Chinese commit message.

---

### Task 1: Plan Slice

**Files:**
- Create: `docs/superpowers/plans/2026-07-02-ui-design-alignment.md`

- [x] **Step 1: Capture implementation boundaries**

Write this plan with the exact renderer-only scope, explicit forbidden feature list, and slice order.

- [ ] **Step 2: Commit the plan**

Run:

```powershell
git add docs/superpowers/plans/2026-07-02-ui-design-alignment.md
git commit -m "docs: 记录界面对齐实施计划"
```

Expected: one commit containing only the plan file.

---

### Task 2: Shell And Theme Slice

**Files:**
- Modify: `src/theme/index.ts`
- Modify: `src/index.css`
- Modify: `src/App.tsx`
- Modify: `src/components/TitleBar.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/common/ResizableSidebar.tsx`

- [ ] **Step 1: Apply design tokens**

Use the reference HTML palette: dark background `#131313`, low surface `#1c1b1b`, container `#201f1f`, high surface `#2a2a2a`, highest surface `#353534`, outline variant `#424754`, primary `#adc6ff`, muted text `#c2c6d6`. Keep light mode functional with matching neutral surfaces and Google-blue primary.

- [ ] **Step 2: Align shell layout**

Set the top bar to 48px, expanded sidebar default to 240px, collapsed sidebar to 64px, and active sidebar item to a 2px primary left border with a rounded surface background.

- [ ] **Step 3: Verify**

Run:

```powershell
npm run typecheck
npm test -- src/components/common/ResizableSidebar.test.ts
```

Expected: both commands pass.

- [ ] **Step 4: Commit**

Run:

```powershell
git add src/theme/index.ts src/index.css src/App.tsx src/components/TitleBar.tsx src/components/Sidebar.tsx src/components/common/ResizableSidebar.tsx
git commit -m "style: 对齐应用外壳与主题质感"
```

Expected: one runnable UI shell commit.

---

### Task 3: Account Manager Slice

**Files:**
- Modify: `src/components/AccountManager.tsx`

- [ ] **Step 1: Align the account list pane**

Keep search, platform filter, CSV import, create account, list item selection, pinning, copy-password, 2FA indicator, context menu, and delete behavior. Change only spacing, surfaces, borders, selected state, icon blocks, and empty state styling.

- [ ] **Step 2: Align the account detail pane**

Keep editable account fields, sensitive visibility/copy controls, password generation, tags, custom fields, notes, and recycle-bin delete confirmation. Restyle the header, field boxes, section labels, chips, custom-field editor, and modal surfaces.

- [ ] **Step 3: Verify**

Run:

```powershell
npm run typecheck
npm test -- src/utils/accountManagerLayout.test.ts src/utils/accountPlatform.test.ts
```

Expected: commands pass and no account data contract changes appear in the diff.

- [ ] **Step 4: Commit**

Run:

```powershell
git add src/components/AccountManager.tsx
git commit -m "style: 优化账号管理界面层级"
```

Expected: one runnable account UI commit.

---

### Task 4: Service Info Slice

**Files:**
- Modify: `src/components/service-info/BatchActionBar.tsx`
- Modify: `src/components/service-info/ServiceDetail.tsx`
- Modify: `src/components/service-info/ServiceFieldGroup.tsx`
- Modify: `src/components/service-info/ServiceFieldRow.tsx`
- Modify: `src/components/service-info/ServiceGroupList.tsx`
- Modify: `src/components/service-info/ServiceInfoManager.tsx`
- Modify: `src/components/service-info/ServiceListItem.tsx`

- [ ] **Step 1: Align service list and group rows**

Keep custom service creation, custom outer groups, group rename/delete/color/collapse, search, sort, favorite, multi-select, move to group, create group from selection, and ungroup. Restyle the list pane to match the reference 320px middle-pane density and grouped row treatment.

- [ ] **Step 2: Align service detail and field groups**

Keep custom fields, custom field names/values, sensitive flag, copy/show/edit/delete, inner field groups, field multi-select, move/create/ungroup, service edit/delete, URL, description, notes, and linked account display. Restyle the header, field boxes, grouped sections, batch action bar, and dialogs.

- [ ] **Step 3: Verify**

Run:

```powershell
npm run typecheck
npm test -- src/utils/serviceInfoGrouping.test.ts src/stores/useStore.serviceInfo.test.ts src/components/service-info/ServiceInfoManager.test.ts src/components/service-info/ServiceFieldGroup.test.ts
```

Expected: commands pass and no schema or IPC files are changed.

- [ ] **Step 4: Commit**

Run:

```powershell
git add src/components/service-info/BatchActionBar.tsx src/components/service-info/ServiceDetail.tsx src/components/service-info/ServiceFieldGroup.tsx src/components/service-info/ServiceFieldRow.tsx src/components/service-info/ServiceGroupList.tsx src/components/service-info/ServiceInfoManager.tsx src/components/service-info/ServiceListItem.tsx
git commit -m "style: 优化服务信息管理界面"
```

Expected: one runnable service-info UI commit.

---

### Task 5: 2FA And Trash Slice

**Files:**
- Modify: `src/components/TwoFactorPanel.tsx`
- Modify: `src/components/TrashManager.tsx`

- [ ] **Step 1: Align 2FA cards and dialogs**

Keep TOTP countdown, HOTP next-code generation, copy, add manual/URI, temporary code generation, linked-account navigation, and delete confirmation. Restyle cards, grouped sections, empty state, buttons, and dialogs.

- [ ] **Step 2: Align trash view**

Keep restore, hard delete, and destructive confirmation. Restyle the page header, deleted-account rows, and confirmation dialog.

- [ ] **Step 3: Verify**

Run:

```powershell
npm run typecheck
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

Run:

```powershell
git add src/components/TwoFactorPanel.tsx src/components/TrashManager.tsx
git commit -m "style: 优化验证器与废纸篓界面"
```

Expected: one runnable 2FA/trash UI commit.

---

### Task 6: Runtime Verification And Push

**Files:**
- No required source changes unless verification reveals a UI defect.

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm run typecheck
npm test
```

Expected: all checks pass.

- [ ] **Step 2: Start the app for user testing**

Run the Vite dev server on an available port:

```powershell
npm run dev -- --host 127.0.0.1
```

Expected: local URL is available for preview, and Electron can still be launched if needed with the same renderer.

- [ ] **Step 3: Push**

Run:

```powershell
git push origin codex/service-info-vault-upgrade
```

Expected: remote branch updates successfully.
