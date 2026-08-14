import jsQR from 'jsqr'
import type { TotpQrImageInput } from '../types'
import { parseOtpAuthUri, type ParsedOtpAuthUri } from './otpAuth'
import { isOtpAuthMigrationUri, parseOtpAuthMigrationUri } from './otpAuthMigration'

export const MAX_QR_IMAGE_FILE_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_EDGE = 8192
const MAX_IMAGE_PIXELS = 40_000_000
const MAX_DECODE_EDGE = 2048
const QR_DECODE_EDGES = [2048, 1600, 1280, 960, 720]
const QR_NOT_FOUND_HINT = '图片中未识别到二维码。Google 迁移码比较密，请尽量只截取一张二维码本身，保存为 PNG 后再试。'

export type ClassifiedTotpQrPayload =
  | { kind: 'single'; parsed: ParsedOtpAuthUri }
  | { kind: 'migration'; entries: ParsedOtpAuthUri[]; skippedCount: number }

export type DecodedTotpQrImage = ClassifiedTotpQrPayload & {
  qrImage: TotpQrImageInput
  previewUrl: string
}

export function classifyTotpQrPayload(rawValue: string): ClassifiedTotpQrPayload {
  const trimmed = String(rawValue || '').trim()
  if (isOtpAuthMigrationUri(trimmed)) {
    const migration = parseOtpAuthMigrationUri(trimmed)
    if (!migration) throw new Error('无法解析 Google Authenticator 迁移数据')
    return {
      kind: 'migration',
      entries: migration.entries,
      skippedCount: migration.skippedCount,
    }
  }

  const parsed = parseOtpAuthUri(trimmed)
  if (!parsed) throw new Error('二维码不是有效的 TOTP/HOTP 验证器二维码')
  return { kind: 'single', parsed }
}

type BarcodeDetectorLike = {
  detect: (image: ImageBitmap | HTMLCanvasElement) => Promise<Array<{ rawValue?: string }>>
}

function getBarcodeDetector(formats: string[]): BarcodeDetectorLike | null {
  const Detector = (globalThis as { BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector
  if (!Detector) return null
  try {
    return new Detector({ formats })
  } catch {
    return null
  }
}

export function getQrDecodeTargetSizes(width: number, height: number) {
  const maxEdge = Math.max(width, height)
  const edges = new Set<number>()
  if (maxEdge <= MAX_DECODE_EDGE) edges.add(maxEdge)
  for (const edge of QR_DECODE_EDGES) {
    if (edge < maxEdge) edges.add(edge)
  }
  if (maxEdge < 640) {
    edges.add(Math.min(MAX_DECODE_EDGE, maxEdge * 2))
    edges.add(Math.min(MAX_DECODE_EDGE, maxEdge * 3))
  }

  return Array.from(edges)
    .sort((left, right) => right - left)
    .slice(0, 6)
    .map((edge) => {
      const scale = edge / maxEdge
      return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
      }
    })
}

export function getQrScanRegions(width: number, height: number) {
  const regions = [{ x: 0, y: 0, width, height }]
  const centerWidth = Math.round(Math.min(width, height) * 0.85)
  if (centerWidth >= 64 && (centerWidth < width || centerWidth < height)) {
    regions.push({
      x: Math.round((width - centerWidth) / 2),
      y: Math.round((height - centerWidth) / 2),
      width: centerWidth,
      height: centerWidth,
    })
  }
  return regions
}

export function toUserQrDecodeError(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message === QR_NOT_FOUND_HINT
      || /请选择|必须小于|尺寸无效|无法读取|无法解析|不是有效/.test(error.message)
    ) {
      return error
    }
  }
  return new Error(QR_NOT_FOUND_HINT)
}

export function grayscaleImageData(imageData: Pick<ImageData, 'width' | 'height' | 'data'>) {
  const data = new Uint8ClampedArray(imageData.data)
  for (let index = 0; index < data.length; index += 4) {
    const gray = Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114)
    data[index] = gray
    data[index + 1] = gray
    data[index + 2] = gray
  }
  return { width: imageData.width, height: imageData.height, data }
}

function readJsQrPayload(imageData: Pick<ImageData, 'width' | 'height' | 'data'>) {
  if (
    !imageData?.data
    || !imageData.width
    || !imageData.height
    || imageData.data.length < imageData.width * imageData.height * 4
  ) {
    return null
  }

  // jsQR's "onlyInvert" option crashes: it scans an undefined inverted matrix.
  try {
    const decoded = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' })
    return decoded?.data?.trim() || null
  } catch {
    return null
  }
}

async function readBarcodeDetectorPayload(source: ImageBitmap | HTMLCanvasElement) {
  const detector = getBarcodeDetector(['qr_code'])
  if (!detector) return null
  try {
    const codes = await detector.detect(source)
    const value = codes.find((code) => typeof code.rawValue === 'string' && code.rawValue.trim())?.rawValue
    return value?.trim() || null
  } catch {
    return null
  }
}

async function readQrPayloadFromBitmap(bitmap: ImageBitmap) {
  const nativePayload = await readBarcodeDetectorPayload(bitmap)
  if (nativePayload) return nativePayload

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('当前环境无法读取二维码图片')

  for (const region of getQrScanRegions(bitmap.width, bitmap.height)) {
    for (const size of getQrDecodeTargetSizes(region.width, region.height)) {
      const pad = Math.max(16, Math.round(Math.max(size.width, size.height) * 0.04))
      canvas.width = size.width + pad * 2
      canvas.height = size.height + pad * 2
      context.imageSmoothingEnabled = false
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(
        bitmap,
        region.x,
        region.y,
        region.width,
        region.height,
        pad,
        pad,
        size.width,
        size.height,
      )

      const colorData = context.getImageData(0, 0, canvas.width, canvas.height)
      const payload = readJsQrPayload(colorData) || readJsQrPayload(grayscaleImageData(colorData))
      if (payload) return payload

      const detectorPayload = await readBarcodeDetectorPayload(canvas)
      if (detectorPayload) return detectorPayload
    }
  }

  return null
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

    try {
      const payload = await readQrPayloadFromBitmap(bitmap)
      if (!payload) throw new Error(QR_NOT_FOUND_HINT)

      const classified = classifyTotpQrPayload(payload)
      const bytes = new Uint8Array(await file.arrayBuffer())
      return {
        ...classified,
        qrImage: {
          bytes,
          mimeType,
          originalName: file.name || (mimeType === 'image/png' ? '2fa-qrcode.png' : '2fa-qrcode.jpg'),
        },
        previewUrl: URL.createObjectURL(file),
      }
    } catch (error) {
      throw toUserQrDecodeError(error)
    }
  } finally {
    bitmap.close()
  }
}
