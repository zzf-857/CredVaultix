import crypto from 'crypto'
import path from 'path'
import { app } from 'electron'
import { isEncryptedValue } from './encryptionFormat'

export { isEncryptedValue } from './encryptionFormat'

// AES-256-GCM obfuscation-at-rest using a key derived from the local app data path.
// This is not a master-password or OS-keystore boundary; see docs/SECURITY.md.
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const BINARY_MAGIC = Buffer.from('CVQB1', 'ascii')
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

export function encryptIfNeeded(value: string): string {
  if (!value || isEncryptedValue(value)) return value
  return encrypt(value)
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

export function encryptBuffer(plaintext: Uint8Array): Buffer {
  const source = Buffer.from(plaintext)
  const key = getCurrentKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(source), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([BINARY_MAGIC, iv, tag, encrypted])
}

export function isEncryptedBuffer(value: Uint8Array) {
  const source = Buffer.from(value)
  return source.length >= BINARY_MAGIC.length + IV_LENGTH + TAG_LENGTH
    && source.subarray(0, BINARY_MAGIC.length).equals(BINARY_MAGIC)
}

export function decryptBuffer(ciphertext: Uint8Array): Buffer {
  const source = Buffer.from(ciphertext)
  if (!isEncryptedBuffer(source)) {
    throw new Error('二维码图片不是有效的加密数据')
  }

  const ivStart = BINARY_MAGIC.length
  const tagStart = ivStart + IV_LENGTH
  const payloadStart = tagStart + TAG_LENGTH
  const iv = source.subarray(ivStart, tagStart)
  const tag = source.subarray(tagStart, payloadStart)
  const encrypted = source.subarray(payloadStart)

  for (const key of getCandidateKeys()) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(encrypted), decipher.final()])
    } catch {
      // Try the next legacy key candidate.
    }
  }

  throw new Error('二维码图片解密失败')
}
