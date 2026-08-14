import { normalizeOtpInput, type ParsedOtpAuthUri } from '../shared/otpAuth'

export interface NormalizedCsvAccount {
  name: string
  platform: string
  username: string
  password: string
  phone: string
  backupEmail: string
  notes: string
  totpSecret: string
  otp: ParsedOtpAuthUri | null
  invalidTotpUri: boolean
}

function text(value: unknown) {
  return String(value || '')
}

export function normalizeCsvAccountRow(row: Record<string, unknown>): NormalizedCsvAccount | null {
  const supportedValues = [
    row.name, row.url, row.title, row.username, row.login, row.email,
    row.password, row.phone, row.backup_email, row.recovery_email,
    row.note, row.notes, row.totp, row.authenticator,
  ]
  if (!supportedValues.some((value) => text(value).trim())) return null

  const name = text(row.name || row.url || row.title || '未命名账号').trim()
  const username = text(row.username || row.login || row.email).trim()
  const totpValue = text(row.totp || row.authenticator).trim()
  const normalizedOtp = normalizeOtpInput(totpValue)

  return {
    name,
    platform: text(row.platform || row.type).trim().toLowerCase(),
    username,
    password: text(row.password),
    phone: text(row.phone).trim(),
    backupEmail: text(row.backup_email || row.recovery_email).trim(),
    notes: text(row.note || row.notes),
    totpSecret: normalizedOtp ? normalizedOtp.secret : '',
    otp: normalizedOtp ? normalizedOtp.parsedUri : null,
    invalidTotpUri: !normalizedOtp,
  }
}
