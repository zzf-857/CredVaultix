import path from 'path'
import type Database from 'better-sqlite3'

export const MAX_TOTP_QR_IMAGE_BYTES = 10 * 1024 * 1024

export interface TotpQrImageInput {
  bytes: Uint8Array
  mimeType?: string
  originalName?: string
}

export interface TotpQrImageRecord {
  totpAccountId: string
  bytes: Buffer
  mimeType: 'image/png' | 'image/jpeg'
  originalName: string
  originalSize: number
}

interface QrImageDependencies {
  encryptBuffer: (value: Uint8Array) => Buffer
  decryptBuffer?: (value: Uint8Array) => Buffer
  now?: () => string
}

interface StoredQrImageRow {
  totp_account_id: string
  encrypted_data: Buffer
  mime_type: string
  original_name: string
  original_size: number
}

function detectMimeType(bytes: Buffer): TotpQrImageRecord['mimeType'] | null {
  if (
    bytes.length >= 8
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  return null
}

function normalizeOriginalName(value?: string, mimeType: TotpQrImageRecord['mimeType'] = 'image/png') {
  const fallback = mimeType === 'image/jpeg' ? '2fa-qrcode.jpg' : '2fa-qrcode.png'
  const baseName = path.basename(String(value || fallback)).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim()
  return baseName || fallback
}

export function normalizeTotpQrImageInput(input: TotpQrImageInput) {
  if (!input || !(input.bytes instanceof Uint8Array)) {
    throw new Error('二维码图片数据无效')
  }
  const bytes = Buffer.from(input.bytes)
  if (bytes.length === 0 || bytes.length > MAX_TOTP_QR_IMAGE_BYTES) {
    throw new Error(`二维码图片大小必须在 1 字节到 ${MAX_TOTP_QR_IMAGE_BYTES / 1024 / 1024} MB 之间`)
  }
  const mimeType = detectMimeType(bytes)
  if (!mimeType) throw new Error('仅支持 PNG 或 JPEG 二维码图片')
  return {
    bytes,
    mimeType,
    originalName: normalizeOriginalName(input.originalName, mimeType),
    originalSize: bytes.length,
  }
}

export function setTotpQrImage(
  db: Database.Database,
  totpAccountId: string,
  input: TotpQrImageInput,
  dependencies: QrImageDependencies
) {
  const normalized = normalizeTotpQrImageInput(input)
  const timestamp = dependencies.now?.() ?? new Date().toISOString()
  db.prepare(`
    INSERT INTO totp_qr_images (
      totp_account_id, encrypted_data, mime_type, original_name, original_size, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(totp_account_id) DO UPDATE SET
      encrypted_data = excluded.encrypted_data,
      mime_type = excluded.mime_type,
      original_name = excluded.original_name,
      original_size = excluded.original_size,
      updated_at = excluded.updated_at
  `).run(
    totpAccountId,
    dependencies.encryptBuffer(normalized.bytes),
    normalized.mimeType,
    normalized.originalName,
    normalized.originalSize,
    timestamp,
    timestamp
  )
}

export function deleteTotpQrImage(db: Database.Database, totpAccountId: string) {
  db.prepare('DELETE FROM totp_qr_images WHERE totp_account_id = ?').run(totpAccountId)
}

export function getTotpQrImage(
  db: Database.Database,
  totpAccountId: string,
  dependencies: Required<Pick<QrImageDependencies, 'decryptBuffer'>>
): TotpQrImageRecord | null {
  const row = db.prepare(`
    SELECT totp_account_id, encrypted_data, mime_type, original_name, original_size
    FROM totp_qr_images
    WHERE totp_account_id = ?
  `).get(totpAccountId) as StoredQrImageRow | undefined
  if (!row) return null

  const bytes = dependencies.decryptBuffer(row.encrypted_data)
  const detectedMimeType = detectMimeType(bytes)
  if (!detectedMimeType) throw new Error('已保存的二维码图片格式无效')
  return {
    totpAccountId: row.totp_account_id,
    bytes,
    mimeType: detectedMimeType,
    originalName: normalizeOriginalName(row.original_name, detectedMimeType),
    originalSize: Number(row.original_size) || bytes.length,
  }
}
