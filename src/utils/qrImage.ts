import jsQR from 'jsqr'
import type { TotpQrImageInput } from '../types'
import { parseOtpAuthUri, type ParsedOtpAuthUri } from './otpAuth'

export const MAX_QR_IMAGE_FILE_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_EDGE = 8192
const MAX_IMAGE_PIXELS = 40_000_000
const MAX_DECODE_EDGE = 4096

export interface DecodedTotpQrImage {
  parsed: ParsedOtpAuthUri
  qrImage: TotpQrImageInput
  previewUrl: string
}

function resolveImageMimeType(file: File): TotpQrImageInput['mimeType'] | null {
  const normalizedType = file.type.toLowerCase()
  if (normalizedType === 'image/png') return 'image/png'
  if (normalizedType === 'image/jpeg' || normalizedType === 'image/jpg') return 'image/jpeg'
  const lowerName = file.name.toLowerCase()
  if (lowerName.endsWith('.png')) return 'image/png'
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg'
  return null
}

export async function decodeTotpQrImage(file: File): Promise<DecodedTotpQrImage> {
  const mimeType = resolveImageMimeType(file)
  if (!mimeType) throw new Error('请选择 PNG 或 JPEG 图片')
  if (file.size === 0 || file.size > MAX_QR_IMAGE_FILE_BYTES) {
    throw new Error('二维码图片大小必须小于 10 MB')
  }

  const bitmap = await createImageBitmap(file)
  try {
    if (
      bitmap.width < 32
      || bitmap.height < 32
      || bitmap.width > MAX_IMAGE_EDGE
      || bitmap.height > MAX_IMAGE_EDGE
      || bitmap.width * bitmap.height > MAX_IMAGE_PIXELS
    ) {
      throw new Error('二维码图片尺寸无效或过大')
    }

    const scale = Math.min(1, MAX_DECODE_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('当前环境无法读取二维码图片')
    context.drawImage(bitmap, 0, 0, width, height)
    const imageData = context.getImageData(0, 0, width, height)
    const decoded = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' })
    if (!decoded?.data) throw new Error('图片中未识别到二维码')

    const rawValue = decoded.data.trim()
    if (rawValue.toLowerCase().startsWith('otpauth-migration://')) {
      throw new Error('暂不支持 Google Authenticator 批量迁移二维码')
    }
    const parsed = parseOtpAuthUri(rawValue)
    if (!parsed) throw new Error('二维码不是有效的 TOTP/HOTP 验证器二维码')

    const bytes = new Uint8Array(await file.arrayBuffer())
    return {
      parsed,
      qrImage: {
        bytes,
        mimeType,
        originalName: file.name || (mimeType === 'image/png' ? '2fa-qrcode.png' : '2fa-qrcode.jpg'),
      },
      previewUrl: URL.createObjectURL(file),
    }
  } finally {
    bitmap.close()
  }
}
