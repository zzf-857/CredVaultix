import crypto from 'crypto'
import { app } from 'electron'

// AES-256-GCM encryption using a machine-specific fixed key
// Plan A: No master password, key derived from app path + machine info
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

function deriveKey(): Buffer {
  const seed = `SecureVault-${app.getPath('userData')}-fixed-local-key-v1`
  return crypto.createHash('sha256').update(seed).digest()
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return ''
  const key = deriveKey()
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
  try {
    const parts = ciphertext.split(':')
    if (parts.length !== 3) return ciphertext // Return as-is if not encrypted
    const iv = Buffer.from(parts[0], 'hex')
    const tag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]
    const key = deriveKey()
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return ciphertext // Return as-is if decryption fails
  }
}
