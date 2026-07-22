import fs from 'node:fs'
import path from 'node:path'

const MAX_LOG_SIZE_BYTES = 2 * 1024 * 1024
const ROTATED_LOG_SUFFIX = '.1'

export interface UpdaterLogger {
  info: (...values: unknown[]) => void
  warn: (...values: unknown[]) => void
  error: (...values: unknown[]) => void
  debug: (...values: unknown[]) => void
}

function fallbackString(value: unknown) {
  try {
    return String(value)
  } catch {
    return '[Unformattable value]'
  }
}

function formatError(error: Error) {
  try {
    if (typeof error.stack === 'string' && error.stack.trim()) {
      return error.stack
    }
  } catch {
    // Some host errors expose properties through throwing getters.
  }

  let name = 'Error'
  let message = ''
  try {
    name = error.name || name
  } catch {
    // Keep the fallback name.
  }
  try {
    message = error.message || ''
  } catch {
    // Keep the fallback message.
  }
  return message ? `${name}: ${message}` : name
}

function formatValue(value: unknown) {
  if (value instanceof Error) return formatError(value)
  if (typeof value === 'string') return value
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'undefined') return 'undefined'
  if (typeof value === 'symbol' || typeof value === 'function') return fallbackString(value)

  if (value !== null && typeof value === 'object') {
    try {
      const seen = new WeakSet<object>()
      const serialized = JSON.stringify(value, (_key, nestedValue) => {
        if (typeof nestedValue === 'bigint') return `${nestedValue}n`
        if (nestedValue instanceof Error) return formatError(nestedValue)
        if (nestedValue !== null && typeof nestedValue === 'object') {
          if (seen.has(nestedValue)) return '[Circular]'
          seen.add(nestedValue)
        }
        return nestedValue
      })
      if (typeof serialized === 'string') return serialized
    } catch {
      // Fall through to a non-throwing string conversion.
    }
  }

  return fallbackString(value)
}

function formatValues(values: unknown[]) {
  return values.map(formatValue).join(' ')
}

function rotateIfNeeded(logFilePath: string, incomingBytes: number) {
  if (!fs.existsSync(logFilePath)) return
  if (fs.statSync(logFilePath).size + incomingBytes <= MAX_LOG_SIZE_BYTES) return

  const rotatedPath = `${logFilePath}${ROTATED_LOG_SUFFIX}`
  fs.rmSync(rotatedPath, { force: true })
  fs.renameSync(logFilePath, rotatedPath)
}

export function createUpdaterLogger(logFilePath: string): UpdaterLogger {
  const write = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', values: unknown[]) => {
    try {
      const line = `${new Date().toISOString()} [${level}] ${formatValues(values)}\n`
      fs.mkdirSync(path.dirname(logFilePath), { recursive: true })
      rotateIfNeeded(logFilePath, Buffer.byteLength(line, 'utf8'))
      fs.appendFileSync(logFilePath, line, 'utf8')
    } catch {
      // Logging must never interrupt checking, downloading, or installing an update.
    }
  }

  return {
    info: (...values) => write('INFO', values),
    warn: (...values) => write('WARN', values),
    error: (...values) => write('ERROR', values),
    debug: (...values) => write('DEBUG', values),
  }
}
