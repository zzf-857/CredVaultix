import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  getPreferencesPath,
  readPreferences,
  replacePreferences,
  resetPreferences,
  updatePreferences,
} from './preferencesStore'

describe('preferencesStore', () => {
  it('reads an empty object when preferences do not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-prefs-empty-'))
    try {
      expect(readPreferences(dir)).toEqual({})
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('merges preference patches and writes them atomically enough for app settings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-prefs-update-'))
    try {
      expect(updatePreferences(dir, { sidebarWidth: 310 })).toEqual({ sidebarWidth: 310 })
      expect(updatePreferences(dir, { sidebarCollapsed: true })).toEqual({
        sidebarWidth: 310,
        sidebarCollapsed: true,
      })
      expect(JSON.parse(readFileSync(getPreferencesPath(dir), 'utf-8'))).toEqual({
        sidebarWidth: 310,
        sidebarCollapsed: true,
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('ignores unknown preference keys from the renderer', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-prefs-unknown-'))
    try {
      expect(updatePreferences(dir, {
        clipboardAutoClear: false,
        unexpectedKey: 'ignored',
        __proto__constructor: 'ignored',
      } as Record<string, unknown>)).toEqual({ clipboardAutoClear: false })
      expect(JSON.parse(readFileSync(getPreferencesPath(dir), 'utf-8'))).toEqual({
        clipboardAutoClear: false,
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('replacePreferences writes only known keys and overwrites the previous file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-prefs-replace-'))
    try {
      updatePreferences(dir, { sidebarWidth: 310, themeMode: 'dark', clipboardAutoClear: false })
      expect(replacePreferences(dir, { themeMode: 'light', sidebarCollapsed: true })).toEqual({
        themeMode: 'light',
        sidebarCollapsed: true,
      })
      expect(JSON.parse(readFileSync(getPreferencesPath(dir), 'utf-8'))).toEqual({
        themeMode: 'light',
        sidebarCollapsed: true,
      })
      expect(readPreferences(dir)).toEqual({
        themeMode: 'light',
        sidebarCollapsed: true,
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('replacePreferences ignores unknown keys', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-prefs-replace-unknown-'))
    try {
      expect(replacePreferences(dir, {
        themeMode: 'light',
        unexpectedKey: 'ignored',
        __proto__constructor: 'ignored',
      } as Record<string, unknown>)).toEqual({ themeMode: 'light' })
      expect(JSON.parse(readFileSync(getPreferencesPath(dir), 'utf-8'))).toEqual({
        themeMode: 'light',
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('resets preferences back to an empty object', () => {
    const dir = mkdtempSync(join(tmpdir(), 'credvaultix-prefs-reset-'))
    try {
      updatePreferences(dir, { sidebarWidth: 320 })
      expect(resetPreferences(dir)).toEqual({})
      expect(readPreferences(dir)).toEqual({})
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
