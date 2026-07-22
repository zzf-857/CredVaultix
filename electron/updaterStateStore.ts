import fs from 'node:fs'
import path from 'node:path'

export type UpdateAttemptStatus = 'downloaded' | 'launching' | 'interrupted' | 'failed' | 'installed'

export interface UpdateAttempt {
  targetVersion: string
  status: UpdateAttemptStatus
  sourceVersion?: string
  installerPath?: string
  startedAt?: string
  updatedAt?: string
  completedAt?: string
  error?: string
}

interface ParsedSemVer {
  major: number
  minor: number
  patch: number
  prerelease: string[]
}

const VALID_STATUSES = new Set<UpdateAttemptStatus>([
  'downloaded',
  'launching',
  'interrupted',
  'failed',
  'installed',
])

const OPTIONAL_STRING_FIELDS = [
  'sourceVersion',
  'installerPath',
  'startedAt',
  'updatedAt',
  'completedAt',
  'error',
] as const

function parseSemVer(version: string): ParsedSemVer | null {
  const match = version.trim().match(
    /^[vV]?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
  )
  if (!match) return null

  const prerelease = match[4] ? match[4].split('.') : []
  if (prerelease.some((identifier) => /^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith('0'))) {
    return null
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  }
}

function compareSemVer(leftVersion: string, rightVersion: string) {
  const left = parseSemVer(leftVersion)
  const right = parseSemVer(rightVersion)
  if (!left || !right) return null

  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1
  }

  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0
  if (left.prerelease.length === 0) return 1
  if (right.prerelease.length === 0) return -1

  const identifierCount = Math.max(left.prerelease.length, right.prerelease.length)
  for (let index = 0; index < identifierCount; index += 1) {
    const leftIdentifier = left.prerelease[index]
    const rightIdentifier = right.prerelease[index]
    if (leftIdentifier === undefined) return -1
    if (rightIdentifier === undefined) return 1
    if (leftIdentifier === rightIdentifier) continue

    const leftIsNumeric = /^\d+$/.test(leftIdentifier)
    const rightIsNumeric = /^\d+$/.test(rightIdentifier)
    if (leftIsNumeric && rightIsNumeric) {
      return Number(leftIdentifier) > Number(rightIdentifier) ? 1 : -1
    }
    if (leftIsNumeric) return -1
    if (rightIsNumeric) return 1
    return leftIdentifier > rightIdentifier ? 1 : -1
  }

  return 0
}

function isUpdateAttempt(value: unknown): value is UpdateAttempt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.targetVersion !== 'string' || !parseSemVer(candidate.targetVersion)) return false
  if (typeof candidate.status !== 'string' || !VALID_STATUSES.has(candidate.status as UpdateAttemptStatus)) return false
  return OPTIONAL_STRING_FIELDS.every((field) => candidate[field] === undefined || typeof candidate[field] === 'string')
}

export function read(filePath: string): UpdateAttempt | null {
  if (!fs.existsSync(filePath)) return null

  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return isUpdateAttempt(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function write(filePath: string, attempt: UpdateAttempt) {
  if (!isUpdateAttempt(attempt)) {
    throw new TypeError('Invalid update attempt')
  }

  const temporaryPath = `${filePath}.tmp`
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(attempt, null, 2)}\n`, 'utf8')
    fs.renameSync(temporaryPath, filePath)
  } catch (error) {
    try {
      fs.rmSync(temporaryPath, { force: true })
    } catch {
      // Preserve the original write or rename failure for the caller.
    }
    throw error
  }
}

export function remove(filePath: string) {
  fs.rmSync(filePath, { force: true })
  fs.rmSync(`${filePath}.tmp`, { force: true })
}

export function reconcile(
  attempt: UpdateAttempt | null,
  currentVersion: string,
  reconciledAt = new Date().toISOString()
): UpdateAttempt | null {
  if (!attempt) return null

  const comparison = compareSemVer(currentVersion, attempt.targetVersion)
  if (comparison !== null && comparison >= 0) {
    if (attempt.status === 'installed') return attempt
    const { error: _error, ...rest } = attempt
    return {
      ...rest,
      status: 'installed',
      updatedAt: reconciledAt,
      completedAt: reconciledAt,
    }
  }

  if (attempt.status !== 'launching') return attempt

  return {
    ...attempt,
    status: 'interrupted',
    updatedAt: reconciledAt,
    error: `Update to ${attempt.targetVersion} did not complete; current version is ${currentVersion}`,
  }
}
