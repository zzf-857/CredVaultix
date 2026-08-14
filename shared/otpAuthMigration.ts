import * as OTPAuth from 'otpauth'
import type { ParsedOtpAuthUri } from './otpAuth'

export interface OtpMigrationParseResult {
  entries: ParsedOtpAuthUri[]
  skippedCount: number
  version: number | null
  batchSize: number | null
  batchIndex: number | null
  batchId: number | null
}

const ALGORITHM_BY_ID: Record<number, ParsedOtpAuthUri['algorithm']> = {
  0: 'SHA1',
  1: 'SHA1',
  2: 'SHA256',
  3: 'SHA512',
}

const DIGITS_BY_ID: Record<number, number> = {
  0: 6,
  1: 6,
  2: 8,
}

const TYPE_BY_ID: Record<number, ParsedOtpAuthUri['otpType']> = {
  0: 'totp',
  1: 'hotp',
  2: 'totp',
}

export function isOtpAuthMigrationUri(value: string): boolean {
  return String(value || '').trim().toLowerCase().startsWith('otpauth-migration://')
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function readVarint(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let result = 0n
  let shift = 0n
  let position = offset
  while (position < bytes.length) {
    const byte = BigInt(bytes[position])
    position += 1
    result |= (byte & 0x7fn) << shift
    if ((byte & 0x80n) === 0n) {
      if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error('varint exceeds a safe integer')
      }
      return { value: Number(result), next: position }
    }
    shift += 7n
    if (shift > 63n) throw new Error('varint is too long')
  }
  throw new Error('truncated varint')
}

function readField(bytes: Uint8Array, offset: number): {
  fieldNumber: number
  wireType: number
  bytes?: Uint8Array
  varint?: number
  next: number
} {
  const tag = readVarint(bytes, offset)
  const fieldNumber = tag.value >>> 3
  const wireType = tag.value & 7
  if (wireType === 0) {
    const value = readVarint(bytes, tag.next)
    return { fieldNumber, wireType, varint: value.value, next: value.next }
  }
  if (wireType === 2) {
    const length = readVarint(bytes, tag.next)
    const start = length.next
    const end = start + length.value
    if (end > bytes.length) throw new Error('truncated length-delimited field')
    return { fieldNumber, wireType, bytes: bytes.subarray(start, end), next: end }
  }
  if (wireType === 1) return { fieldNumber, wireType, next: tag.next + 8 }
  if (wireType === 5) return { fieldNumber, wireType, next: tag.next + 4 }
  throw new Error(`unsupported protobuf wire type ${wireType}`)
}

function secretBytesToBase32(secretBytes: Uint8Array): string {
  const buffer = secretBytes.buffer.slice(
    secretBytes.byteOffset,
    secretBytes.byteOffset + secretBytes.byteLength
  ) as ArrayBuffer
  return new OTPAuth.Secret({ buffer }).base32
}

function parseOtpParameters(bytes: Uint8Array): ParsedOtpAuthUri | null {
  let secretBytes: Uint8Array | null = null
  let name = ''
  let issuer = ''
  let algorithm = 0
  let digits = 0
  let type = 0
  let counter = 0

  let offset = 0
  while (offset < bytes.length) {
    const field = readField(bytes, offset)
    offset = field.next
    if (field.fieldNumber === 1 && field.bytes) secretBytes = field.bytes
    if (field.fieldNumber === 2 && field.bytes) name = new TextDecoder().decode(field.bytes)
    if (field.fieldNumber === 3 && field.bytes) issuer = new TextDecoder().decode(field.bytes)
    if (field.fieldNumber === 4 && field.varint !== undefined) algorithm = field.varint
    if (field.fieldNumber === 5 && field.varint !== undefined) digits = field.varint
    if (field.fieldNumber === 6 && field.varint !== undefined) type = field.varint
    if (field.fieldNumber === 7 && field.varint !== undefined) counter = field.varint
  }

  if (!secretBytes || secretBytes.length === 0) return null

  let secret: string
  try {
    secret = secretBytesToBase32(secretBytes)
    OTPAuth.Secret.fromBase32(secret)
  } catch {
    return null
  }

  let label = name
  if (!issuer && name.includes(':')) {
    const separator = name.indexOf(':')
    issuer = name.slice(0, separator)
    label = name.slice(separator + 1)
  } else if (issuer && name.startsWith(`${issuer}:`)) {
    label = name.slice(issuer.length + 1)
  }

  const otpType = TYPE_BY_ID[type] ?? 'totp'
  return {
    issuer: issuer.trim(),
    label: label.trim() || issuer.trim() || '未命名账户',
    secret,
    algorithm: ALGORITHM_BY_ID[algorithm] ?? 'SHA1',
    digits: DIGITS_BY_ID[digits] ?? 6,
    period: 30,
    otpType,
    counter: otpType === 'hotp' ? Math.max(0, counter) : 0,
  }
}

export function parseOtpAuthMigrationUri(uri: string): OtpMigrationParseResult | null {
  try {
    const trimmed = String(uri || '').trim()
    if (!isOtpAuthMigrationUri(trimmed)) return null

    const url = new URL(trimmed)
    const data = url.searchParams.get('data')
    if (!data) return null

    const payload = decodeBase64Url(data)
    if (payload.length === 0) return null

    const entries: ParsedOtpAuthUri[] = []
    let skippedCount = 0
    let version: number | null = null
    let batchSize: number | null = null
    let batchIndex: number | null = null
    let batchId: number | null = null

    let offset = 0
    while (offset < payload.length) {
      const field = readField(payload, offset)
      offset = field.next
      if (field.fieldNumber === 1 && field.bytes) {
        const entry = parseOtpParameters(field.bytes)
        if (entry) entries.push(entry)
        else skippedCount += 1
      } else if (field.fieldNumber === 2 && field.varint !== undefined) {
        version = field.varint
      } else if (field.fieldNumber === 3 && field.varint !== undefined) {
        batchSize = field.varint
      } else if (field.fieldNumber === 4 && field.varint !== undefined) {
        batchIndex = field.varint
      } else if (field.fieldNumber === 5 && field.varint !== undefined) {
        batchId = field.varint
      }
    }

    return { entries, skippedCount, version, batchSize, batchIndex, batchId }
  } catch {
    return null
  }
}
