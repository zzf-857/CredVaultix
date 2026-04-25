# AccountManager 1.x Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Narrow the current product into a focused local account manager for Google and Microsoft accounts with reusable account tags and first-class 2FA.

**Architecture:** Keep the existing Electron + React mainline, preserve current account and 2FA flows, add the smallest possible platform and account-tag model, then remove Prompt/address-generator UI and store dependencies. Keep legacy prompt tables for compatibility but stop exposing them in the product.

**Tech Stack:** Electron 31, React 18, TypeScript, Zustand, MUI v5, better-sqlite3, Vitest

---

## File Structure

### New Files

- `src/utils/accountPlatform.ts`: platform labels, normalization helpers, suggested-tag helpers
- `src/utils/accountPlatform.test.ts`: focused test coverage for the helper behavior
- `src/components/AccountPlatformDialog.tsx`: create-account platform chooser or inline selector

### Modified Files

- `package.json`: add test scripts and Vitest dependency
- `package-lock.json`: dependency lock update
- `vite.config.ts`: add test config only if needed
- `electron/database.ts`: add account platform and `account_tags` migration
- `electron/main.ts`: add account-tag IPC, include tags in account reads, remove product-facing prompt/address assumptions
- `electron/preload.ts`: expose account-tag APIs
- `src/types.ts`: extend account types and Electron API definitions
- `src/stores/useStore.ts`: remove prompt state/actions, add platform filter and account-tag actions
- `src/App.tsx`: remove Prompt/address views
- `src/components/Sidebar.tsx`: narrow navigation to accounts, 2FA, trash
- `src/components/AccountManager.tsx`: add platform-aware list/detail behavior and tag UI
- `README.md`: update product description to the focused 1.x scope

### Verification Targets

- `npm test`
- `npm run build`
- `npx tsc -b --pretty false`

## Task 1: Add Minimal Test Harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/utils/accountPlatform.test.ts`
- Create: `src/utils/accountPlatform.ts`

- [ ] **Step 1: Add Vitest dependency and scripts**
- [ ] **Step 2: Write failing helper tests for platform normalization and suggested tags**
- [ ] **Step 3: Run the tests and confirm they fail for missing module behavior**
- [ ] **Step 4: Implement the minimal helper module**
- [ ] **Step 5: Run `npm test` and confirm the helper tests pass**

## Task 2: Add Platform and Account Tag Data Support

**Files:**
- Modify: `electron/database.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Add failing tests for any new pure helper behavior needed by the data layer**
- [ ] **Step 2: Add SQLite migrations for `accounts.platform` and `account_tags`**
- [ ] **Step 3: Update account read/write IPC to include platform and account tags**
- [ ] **Step 4: Expose new account-tag APIs through preload and types**
- [ ] **Step 5: Re-run tests and typecheck the changed interfaces**

## Task 3: Narrow the Renderer to the Focused Product

**Files:**
- Modify: `src/stores/useStore.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/AccountManager.tsx`
- Create: `src/components/AccountPlatformDialog.tsx`

- [ ] **Step 1: Remove Prompt/address state and views from the store and app shell**
- [ ] **Step 2: Add platform filtering and Google/Microsoft account creation UX**
- [ ] **Step 3: Add reusable account tag editing and suggested platform tags**
- [ ] **Step 4: Keep `2FA` linkage and recycle-bin flows intact**
- [ ] **Step 5: Run build and confirm the narrowed renderer compiles**

## Task 4: Update Product Copy and Final Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README to reflect the focused 1.x product**
- [ ] **Step 2: Run `npm test`**
- [ ] **Step 3: Run `npx tsc -b --pretty false`**
- [ ] **Step 4: Run `npm run build`**
- [ ] **Step 5: Review the final diff for stray Prompt/address references and summarize residual risks**
