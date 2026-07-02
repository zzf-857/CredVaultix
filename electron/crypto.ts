import crypto from 'crypto'
import path from 'path'
import { app } from 'electron'

// AES-256-GCM encryption using a machine-specific fixed key
// Plan A: No master password, key derived from app path + machine info
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const CURRENT_KEY_PREFIX = 'CredVaultix'
const LEGACY_KEY_PREFIX = 'SecureVault'
const LEGACY_USER_DATA_NAMES = ['account-manager', 'AccountManager', 'prompt-manager']

function deriveKey(prefix: string, userDataPath: string): Buffer {
  const seed = `${prefix}-${userDataPath}-fixed-local-key-v1`
  return crypto.createHash('sha256').update(seed).digest()
}

function getCurrentKey(): Buffer {
  return deriveKey(CURRENT_KEY_PREFIX, app.getPath('userData'))
}

function getCandidateKeys(): Buffer[] {
  const appDataPath = app.getPath('appData')
  const userDataPath = app.getPath('userData')
  const candidates: Array<[string, string]> = [
    [CURRENT_KEY_PREFIX, userDataPath],
    [LEGACY_KEY_PREFIX, userDataPath],
    ...LEGACY_USER_DATA_NAMES.map((name): [string, string] => [
      LEGACY_KEY_PREFIX,
      path.join(appDataPath, name),
    ]),
  ]
  const seen = new Set<string>()

  return candidates
    .filter(([prefix, candidatePath]) => {
      const key = `${prefix}:${path.normalize(candidatePath)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map(([prefix, candidatePath]) => deriveKey(prefix, candidatePath))
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return ''
  const key = getCurrentKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag()
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ''
  const parts = ciphertext.split(':')
  if (parts.length !== 3) return ciphertext // Return as-is if not encrypted
  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]

  for (const key of getCandidateKeys()) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
      decipher.setAuthTag(tag)
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch {
      // Try the next legacy key candidate.
    }
  }

  return ciphertext // Return as-is if decryption fails
}
