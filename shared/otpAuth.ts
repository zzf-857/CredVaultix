import * as OTPAuth from 'otpauth'

export interface ParsedOtpAuthUri {
  issuer: string
  label: string
  secret: string
  algorithm: 'SHA1' | 'SHA256' | 'SHA512'
  digits: number
  period: number
  otpType: 'totp' | 'hotp'
  counter: number
}

function normalizeInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

export function parseOtpAuthUri(uri: string): ParsedOtpAuthUri | null {
  try {
    const url = new URL(uri)
    if (url.protocol !== 'otpauth:') return null

    const otpType = url.hostname.toLowerCase()
    if (otpType !== 'totp' && otpType !== 'hotp') return null

    const path = decodeURIComponent(url.pathname.slice(1))
    const pathParts = path.split(':')
    const secret = (url.searchParams.get('secret') || '').replace(/\s/g, '').toUpperCase()
    if (!secret) return null
    OTPAuth.Secret.fromBase32(secret)

    const requestedAlgorithm = (url.searchParams.get('algorithm') || 'SHA1')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
    const algorithm = (['SHA1', 'SHA256', 'SHA512'].includes(requestedAlgorithm)
      ? requestedAlgorithm
      : 'SHA1') as ParsedOtpAuthUri['algorithm']
    const issuer = url.searchParams.get('issuer') || (pathParts.length > 1 ? pathParts[0] : '')
    const label = pathParts.length > 1 ? pathParts.slice(1).join(':') : path

    return {
      issuer,
      label: label || issuer || '未命名账户',
      secret,
      algorithm,
      digits: normalizeInteger(url.searchParams.get('digits'), 6, 6, 10),
      period: normalizeInteger(url.searchParams.get('period'), 30, 5, 300),
      otpType,
      counter: normalizeInteger(url.searchParams.get('counter'), 0, 0, Number.MAX_SAFE_INTEGER),
    }
  } catch {
    return null
  }
}
