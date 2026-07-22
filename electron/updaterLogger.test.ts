import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createUpdaterLogger } from './updaterLogger'

const temporaryDirectories: string[] = []

function createTemporaryDirectory() {
  const directory = mkdtempSync(path.join(tmpdir(), 'credvaultix-updater-log-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('updaterLogger', () => {
  it('writes every supported level synchronously', () => {
    const logFilePath = path.join(createTemporaryDirectory(), 'logs', 'updater.log')
    const logger = createUpdaterLogger(logFilePath)

    logger.info('downloaded', { version: '1.2.3' })
    logger.warn('retrying')
    logger.error(new Error('installer spawn failed'))
    logger.debug('installer', 'C:/Temp/update.exe')

    const contents = readFileSync(logFilePath, 'utf8')
    expect(contents).toMatch(/^\d{4}-\d{2}-\d{2}T.* \[INFO] downloaded \{"version":"1\.2\.3"\}/m)
    expect(contents).toContain('[WARN] retrying')
    expect(contents).toContain('[ERROR] Error: installer spawn failed')
    expect(contents).toContain('[DEBUG] installer C:/Temp/update.exe')
  })

  it('formats circular, bigint, and hostile values without throwing', () => {
    const logFilePath = path.join(createTemporaryDirectory(), 'updater.log')
    const logger = createUpdaterLogger(logFilePath)
    const circular: Record<string, unknown> = { phase: 'launching', bytes: 10n }
    circular.self = circular
    const hostile = {
      toJSON() {
        throw new Error('cannot serialize')
      },
      toString() {
        throw new Error('cannot stringify')
      },
    }

    expect(() => logger.error(circular, hostile)).not.toThrow()

    const contents = readFileSync(logFilePath, 'utf8')
    expect(contents).toContain('"bytes":"10n"')
    expect(contents).toContain('"self":"[Circular]"')
    expect(contents).toContain('[Unformattable value]')
  })

  it('rotates an approximately two megabyte log before appending', () => {
    const directory = createTemporaryDirectory()
    const logFilePath = path.join(directory, 'updater.log')
    writeFileSync(logFilePath, 'x'.repeat(2 * 1024 * 1024), 'utf8')

    createUpdaterLogger(logFilePath).info('first entry after rotation')

    expect(statSync(`${logFilePath}.1`).size).toBe(2 * 1024 * 1024)
    expect(readFileSync(logFilePath, 'utf8')).toContain('first entry after rotation')
  })

  it('does not throw when the destination cannot be created', () => {
    const directory = createTemporaryDirectory()
    const blockingFile = path.join(directory, 'not-a-directory')
    writeFileSync(blockingFile, 'blocked', 'utf8')
    const logger = createUpdaterLogger(path.join(blockingFile, 'updater.log'))

    expect(() => logger.info('this write cannot succeed')).not.toThrow()
  })
})
