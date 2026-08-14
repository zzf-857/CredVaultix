import { describe, expect, it } from 'vitest'
import * as OTPAuth from 'otpauth'
import { isOtpAuthMigrationUri, parseOtpAuthMigrationUri } from './otpAuthMigration'

const SAMPLE_SECRET = 'JBSWY3DPEHPK3PXP'
const HOTP_SECRET = 'KRUGS4ZANFZSAYJA'

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

function encodeKey(fieldNumber: number, wireType: number): number[] {
  return encodeVarint((fieldNumber << 3) | wireType)
}

function encodeBytes(fieldNumber: number, data: Uint8Array): number[] {
  return [...encodeKey(fieldNumber, 2), ...encodeVarint(data.length), ...Array.from(data)]
}

function encodeString(fieldNumber: number, value: string): number[] {
  return encodeBytes(fieldNumber, new TextEncoder().encode(value))
}

function encodeVarintField(fieldNumber: number, value: number): number[] {
  return [...encodeKey(fieldNumber, 0), ...encodeVarint(value)]
}

function encodeOtpParameters(entry: {
  secret: string
  name: string
  issuer: string
  algorithm: number
  digits: number
  type: number
  counter: number
}): Uint8Array {
  const secret = OTPAuth.Secret.fromBase32(entry.secret)
  return new Uint8Array([
    ...encodeBytes(1, secret.bytes),
    ...encodeString(2, entry.name),
    ...encodeString(3, entry.issuer),
    ...encodeVarintField(4, entry.algorithm),
    ...encodeVarintField(5, entry.digits),
    ...encodeVarintField(6, entry.type),
    ...encodeVarintField(7, entry.counter),
  ])
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function encodeMigrationUri(parameters: Uint8Array[], extras: number[] = []): string {
  const payload = new Uint8Array([
    ...parameters.flatMap((entry) => encodeBytes(1, entry)),
    ...extras,
  ])
  return `otpauth-migration://offline?data=${encodeBase64Url(payload)}`
}

describe('isOtpAuthMigrationUri', () => {
  it('detects Google Authenticator migration URIs', () => {
    expect(isOtpAuthMigrationUri('otpauth-migration://offline?data=abc')).toBe(true)
    expect(isOtpAuthMigrationUri('  OTPAUTH-MIGRATION://offline?data=abc  ')).toBe(true)
    expect(isOtpAuthMigrationUri('otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP')).toBe(false)
    expect(isOtpAuthMigrationUri('')).toBe(false)
  })
})

describe('parseOtpAuthMigrationUri', () => {
  it('decodes TOTP and HOTP entries from a hand-built protobuf payload', () => {
    const uri = encodeMigrationUri([
      encodeOtpParameters({
        secret: SAMPLE_SECRET,
        name: 'GitHub:octocat',
        issuer: 'GitHub',
        algorithm: 1,
        digits: 1,
        type: 2,
        counter: 0,
      }),
      encodeOtpParameters({
        secret: HOTP_SECRET,
        name: 'owner',
        issuer: 'Example',
        algorithm: 2,
        digits: 2,
        type: 1,
        counter: 7,
      }),
    ], [
      ...encodeVarintField(2, 1),
      ...encodeVarintField(3, 1),
      ...encodeVarintField(4, 0),
      ...encodeVarintField(5, 42),
    ])

    expect(parseOtpAuthMigrationUri(uri)).toEqual({
      entries: [
        {
          issuer: 'GitHub',
          label: 'octocat',
          secret: SAMPLE_SECRET,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          otpType: 'totp',
          counter: 0,
        },
        {
          issuer: 'Example',
          label: 'owner',
          secret: HOTP_SECRET,
          algorithm: 'SHA256',
          digits: 8,
          period: 30,
          otpType: 'hotp',
          counter: 7,
        },
      ],
      skippedCount: 0,
      version: 1,
      batchSize: 1,
      batchIndex: 0,
      batchId: 42,
    })
  })

  it('splits issuer:label from the name when issuer is empty', () => {
    const uri = encodeMigrationUri([
      encodeOtpParameters({
        secret: SAMPLE_SECRET,
        name: 'Google:user@example.com',
        issuer: '',
        algorithm: 1,
        digits: 1,
        type: 2,
        counter: 0,
      }),
    ])

    expect(parseOtpAuthMigrationUri(uri)?.entries[0]).toMatchObject({
      issuer: 'Google',
      label: 'user@example.com',
    })
  })

  it('skips entries without a usable secret and still returns valid neighbors', () => {
    const uri = encodeMigrationUri([
      new Uint8Array(encodeString(2, 'broken')),
      encodeOtpParameters({
        secret: SAMPLE_SECRET,
        name: 'kept',
        issuer: 'Kept',
        algorithm: 1,
        digits: 1,
        type: 2,
        counter: 0,
      }),
    ])

    const parsed = parseOtpAuthMigrationUri(uri)
    expect(parsed?.skippedCount).toBe(1)
    expect(parsed?.entries).toHaveLength(1)
    expect(parsed?.entries[0].label).toBe('kept')
  })

  it('accepts standard base64 data in addition to base64url', () => {
    const urlSafe = encodeMigrationUri([
      encodeOtpParameters({
        secret: SAMPLE_SECRET,
        name: 'plus',
        issuer: 'Plus',
        algorithm: 1,
        digits: 1,
        type: 2,
        counter: 0,
      }),
    ])
    const data = new URL(urlSafe).searchParams.get('data') || ''
    const standard = data.replace(/-/g, '+').replace(/_/g, '/')
    const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4)

    expect(parseOtpAuthMigrationUri(`otpauth-migration://offline?data=${encodeURIComponent(padded)}`)?.entries[0].label)
      .toBe('plus')
  })

  it('returns null for non-migration URIs and empty payloads', () => {
    expect(parseOtpAuthMigrationUri('otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP')).toBeNull()
    expect(parseOtpAuthMigrationUri('otpauth-migration://offline')).toBeNull()
    expect(parseOtpAuthMigrationUri('otpauth-migration://offline?data=')).toBeNull()
    expect(parseOtpAuthMigrationUri('otpauth-migration://offline?data=@@@')).toBeNull()
  })
})
