import { describe, expect, it } from 'vitest'
import { classifyTotpQrPayload, getQrDecodeTargetSizes, getQrScanRegions, grayscaleImageData, toUserQrDecodeError } from './qrImage'
import { parseOtpAuthMigrationUri } from './otpAuthMigration'
import * as OTPAuth from 'otpauth'

function encodeVarint(value: number): number[] {
  const bytes: number[] = []
  let remaining = BigInt(value)
  while (remaining > 127n) {
    bytes.push(Number((remaining & 0x7fn) | 0x80n))
    remaining >>= 7n
  }
  bytes.push(Number(remaining))
  return bytes
}

function encodeBytes(fieldNumber: number, data: Uint8Array): number[] {
  return [...encodeVarint((fieldNumber << 3) | 2), ...encodeVarint(data.length), ...Array.from(data)]
}

function encodeString(fieldNumber: number, value: string): number[] {
  return encodeBytes(fieldNumber, new TextEncoder().encode(value))
}

function encodeVarintField(fieldNumber: number, value: number): number[] {
  return [...encodeVarint((fieldNumber << 3) | 0), ...encodeVarint(value)]
}

function migrationUriFor(secret: string, name: string, issuer: string) {
  const secretBytes = OTPAuth.Secret.fromBase32(secret).bytes
  const parameters = new Uint8Array([
    ...encodeBytes(1, secretBytes),
    ...encodeString(2, name),
    ...encodeString(3, issuer),
    ...encodeVarintField(4, 1),
    ...encodeVarintField(5, 1),
    ...encodeVarintField(6, 2),
  ])
  const payload = new Uint8Array(encodeBytes(1, parameters))
  let binary = ''
  for (const byte of payload) binary += String.fromCharCode(byte)
  const data = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return `otpauth-migration://offline?data=${data}`
}

describe('getQrDecodeTargetSizes', () => {
  it('keeps a mid-size image and also tries smaller decode edges', () => {
    const sizes = getQrDecodeTargetSizes(1800, 1200)
    expect(sizes[0]).toEqual({ width: 1800, height: 1200 })
    expect(sizes.some((size) => size.width === 1280)).toBe(true)
  })

  it('upscales a small screenshot so dense migration codes have more pixels per module', () => {
    const sizes = getQrDecodeTargetSizes(280, 280)
    expect(sizes.some((size) => size.width >= 560)).toBe(true)
  })
})

describe('getQrScanRegions', () => {
  it('always includes the full image and adds a centered crop for wide screenshots', () => {
    const regions = getQrScanRegions(1920, 1080)
    expect(regions[0]).toEqual({ x: 0, y: 0, width: 1920, height: 1080 })
    expect(regions.some((region) => region.width === region.height && region.width < 1920)).toBe(true)
  })
})

describe('toUserQrDecodeError', () => {
  it('hides jsQR internal crashes behind the missing-code hint', () => {
    expect(toUserQrDecodeError(new TypeError("Cannot read properties of undefined (reading 'height')")).message)
      .toMatch(/未识别到二维码/)
    expect(toUserQrDecodeError(new Error('请选择 PNG 或 JPEG 图片')).message).toBe('请选择 PNG 或 JPEG 图片')
  })
})

describe('grayscaleImageData', () => {
  it('converts pixels to luminance while keeping alpha', () => {
    const imageData = {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([255, 0, 0, 128]),
    } as ImageData
    expect(Array.from(grayscaleImageData(imageData).data)).toEqual([76, 76, 76, 128])
  })
})

describe('classifyTotpQrPayload', () => {
  it('classifies a standard otpauth URI as a single account', () => {
    expect(classifyTotpQrPayload('otpauth://totp/Example:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example')).toEqual({
      kind: 'single',
      parsed: {
        issuer: 'Example',
        label: 'user@example.com',
        secret: 'JBSWY3DPEHPK3PXP',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        otpType: 'totp',
        counter: 0,
      },
    })
  })

  it('classifies a Google Authenticator migration URI as a batch', () => {
    const uri = migrationUriFor('JBSWY3DPEHPK3PXP', 'GitHub:octocat', 'GitHub')
    const classified = classifyTotpQrPayload(uri)
    const parsed = parseOtpAuthMigrationUri(uri)

    expect(classified).toEqual({
      kind: 'migration',
      entries: parsed?.entries,
      skippedCount: 0,
    })
  })

  it('rejects invalid migration payloads and ordinary non-otp text', () => {
    expect(() => classifyTotpQrPayload('otpauth-migration://offline?data=@@@')).toThrow(/无法解析 Google Authenticator 迁移数据/)
    expect(() => classifyTotpQrPayload('not-a-qr')).toThrow(/不是有效的 TOTP\/HOTP/)
  })
})
