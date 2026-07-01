import fs from 'fs'
import path from 'path'

export type AppPreferences = Record<string, unknown>

export function getPreferencesPath(userDataPath: string) {
  return path.join(userDataPath, 'preferences.json')
}

export function readPreferences(userDataPath: string): AppPreferences {
  const preferencesPath = getPreferencesPath(userDataPath)
  if (!fs.existsSync(preferencesPath)) {
    return {}
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(preferencesPath, 'utf-8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writePreferences(userDataPath: string, preferences: AppPreferences) {
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }

  const preferencesPath = getPreferencesPath(userDataPath)
  const tempPath = `${preferencesPath}.tmp`
  fs.writeFileSync(tempPath, JSON.stringify(preferences, null, 2), 'utf-8')
  fs.renameSync(tempPath, preferencesPath)
}

export function updatePreferences(userDataPath: string, patch: AppPreferences) {
  const next = { ...readPreferences(userDataPath), ...patch }
  writePreferences(userDataPath, next)
  return next
}

export function resetPreferences(userDataPath: string) {
  writePreferences(userDataPath, {})
  return {}
}
