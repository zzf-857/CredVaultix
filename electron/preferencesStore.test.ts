import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  getPreferencesPath,
  readPreferences,
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
