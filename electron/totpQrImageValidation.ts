import { nativeImage } from 'electron'
import {
  normalizeTotpQrImageInput,
  type TotpQrImageInput,
} from './totpQrImageRepository'

export function prepareTotpQrImage(input: TotpQrImageInput | null | undefined) {
  if (input === null || input === undefined) return input

  const normalized = normalizeTotpQrImageInput(input)
  const image = nativeImage.createFromBuffer(normalized.bytes)
  if (image.isEmpty()) throw new Error('无法读取二维码图片')

  const { width, height } = image.getSize()
  if (width < 32 || height < 32 || width > 8192 || height > 8192 || width * height > 40_000_000) {
    throw new Error('二维码图片尺寸无效或过大')
  }

  return {
    bytes: new Uint8Array(normalized.bytes),
    mimeType: normalized.mimeType,
    originalName: normalized.originalName,
  }
}
