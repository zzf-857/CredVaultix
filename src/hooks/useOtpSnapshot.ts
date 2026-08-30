import { useMemo } from 'react'
import {
  generateOtpCode,
  getOtpTiming,
  type OtpConfiguration,
} from '../utils/otpSnapshot'
import { useSharedNow } from './useSharedNow'

export function useOtpSnapshot(configuration: OtpConfiguration) {
  const {
    secret,
    otpType = 'totp',
    algorithm = 'SHA1',
    digits = 6,
    period = 30,
    counter = 0,
    issuer,
    label,
  } = configuration
  const nowMs = useSharedNow()
  const timing = getOtpTiming(nowMs, otpType, period, counter)
  const timestampMs = timing.isHotp
    ? 0
    : timing.window * timing.period * 1000

  const generation = useMemo(() => generateOtpCode({
    secret,
    otpType,
    algorithm,
    digits,
    period: timing.period,
    counter,
    issuer,
    label,
  }, timestampMs), [
    algorithm,
    counter,
    digits,
    issuer,
    label,
    otpType,
    secret,
    timestampMs,
    timing.period,
  ])

  return {
    ...generation,
    ...timing,
    remaining: generation.failed && !timing.isHotp ? 0 : timing.remaining,
    progress: generation.failed && !timing.isHotp ? 0 : timing.progress,
    urgent: generation.failed && !timing.isHotp ? true : timing.urgent,
  }
}
