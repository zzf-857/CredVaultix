import * as OTPAuth from 'otpauth'

export interface OtpConfiguration {
  secret: string
  otpType?: string
  algorithm?: string
  digits?: number
  period?: number
  counter?: number
  issuer?: string
  label?: string
}

export interface OtpGenerationResult {
  code: string
  empty: boolean
  failed: boolean
}

export interface OtpTiming {
  isHotp: boolean
  period: number
  window: number
  remaining: number
  progress: number
  urgent: boolean
}

function normalizeDigits(digits = 6) {
  return Number.isInteger(digits) && digits > 0 ? digits : 6
}

function normalizePeriod(period = 30) {
  return Number.isFinite(period) && period > 0 ? period : 30
}

function normalizeCounter(counter = 0) {
  return Number.isSafeInteger(counter) && counter >= 0 ? counter : 0
}

export function getTotpRemainingSeconds(now: number, period: number) {
  const safePeriod = normalizePeriod(period)
  return safePeriod - (Math.floor(now / 1000) % safePeriod)
}

export function getTotpWindow(now: number, period: number) {
  const safePeriod = normalizePeriod(period)
  return Math.floor(Math.floor(now / 1000) / safePeriod)
}

export function getOtpTiming(
  now: number,
  otpType: string | undefined,
  period: number | undefined,
  counter: number | undefined
): OtpTiming {
  const isHotp = otpType === 'hotp'
  const safePeriod = normalizePeriod(period)
  if (isHotp) {
    return {
      isHotp: true,
      period: safePeriod,
      window: normalizeCounter(counter),
      remaining: -1,
      progress: 100,
      urgent: false,
    }
  }

  const remaining = getTotpRemainingSeconds(now, safePeriod)
  return {
    isHotp: false,
    period: safePeriod,
    window: getTotpWindow(now, safePeriod),
    remaining,
    progress: (remaining / safePeriod) * 100,
    urgent: remaining <= 5,
  }
}

export function generateOtpCode(
  configuration: OtpConfiguration,
  timestampMs = Date.now()
): OtpGenerationResult {
  const digits = normalizeDigits(configuration.digits)
  const placeholder = '-'.repeat(digits)
  const cleanSecret = configuration.secret.replace(/\s/g, '').toUpperCase()
  if (!cleanSecret) return { code: placeholder, empty: true, failed: false }

  try {
    const secret = OTPAuth.Secret.fromBase32(cleanSecret)
    const algorithm = configuration.algorithm || 'SHA1'
    if (configuration.otpType === 'hotp') {
      const counter = normalizeCounter(configuration.counter)
      const hotp = new OTPAuth.HOTP({
        issuer: configuration.issuer,
        label: configuration.label,
        algorithm,
        digits,
        counter,
        secret,
      })
      return { code: hotp.generate({ counter }), empty: false, failed: false }
    }

    const period = normalizePeriod(configuration.period)
    const totp = new OTPAuth.TOTP({
      issuer: configuration.issuer,
      label: configuration.label,
      algorithm,
      digits,
      period,
      secret,
    })
    return {
      code: totp.generate({ timestamp: timestampMs }),
      empty: false,
      failed: false,
    }
  } catch {
    return { code: placeholder, empty: false, failed: true }
  }
}

export function isValidOtpSecret(secret: string) {
  const result = generateOtpCode({ secret })
  return !result.empty && !result.failed
}
