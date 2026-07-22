import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { type UpdateAttempt, read, reconcile, remove, write } from './updaterStateStore'

const temporaryDirectories: string[] = []

function createStatePath() {
  const directory = mkdtempSync(path.join(tmpdir(), 'credvaultix-updater-state-'))
  temporaryDirectories.push(directory)
  return path.join(directory, 'state', 'update-attempt.json')
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('updaterStateStore', () => {
  it('atomically writes, reads, and replaces an update attempt', () => {
    const filePath = createStatePath()
    const downloaded: UpdateAttempt = {
      sourceVersion: '1.1.1',
      targetVersion: '1.1.2',
      status: 'downloaded',
      installerPath: 'C:/Temp/CredVaultix-Setup-1.1.2.exe',
      updatedAt: '2026-07-22T10:00:00.000Z',
    }

    write(filePath, downloaded)
    expect(read(filePath)).toEqual(downloaded)
    expect(existsSync(`${filePath}.tmp`)).toBe(false)

    const launching: UpdateAttempt = {
      ...downloaded,
      status: 'launching',
      startedAt: '2026-07-22T10:01:00.000Z',
      updatedAt: '2026-07-22T10:01:00.000Z',
    }
    write(filePath, launching)

    expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual(launching)
    expect(read(filePath)).toEqual(launching)
    expect(existsSync(`${filePath}.tmp`)).toBe(false)
  })

  it('returns null for missing, corrupted, or structurally invalid state', () => {
    const filePath = createStatePath()
    expect(read(filePath)).toBeNull()

    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, '{not-json', 'utf8')
    expect(read(filePath)).toBeNull()

    writeFileSync(filePath, JSON.stringify({ targetVersion: 'not-semver', status: 'launching' }), 'utf8')
    expect(read(filePath)).toBeNull()

    writeFileSync(filePath, JSON.stringify({ targetVersion: '1.2.3', status: 'unknown' }), 'utf8')
    expect(read(filePath)).toBeNull()
  })

  it('removes both the committed state and a leftover temporary file', () => {
    const filePath = createStatePath()
    write(filePath, { targetVersion: '1.2.3', status: 'downloaded' })
    writeFileSync(`${filePath}.tmp`, 'partial', 'utf8')

    remove(filePath)
    remove(filePath)

    expect(existsSync(filePath)).toBe(false)
    expect(existsSync(`${filePath}.tmp`)).toBe(false)
  })

  it('marks equal, newer, and valid prerelease versions as installed', () => {
    const timestamp = '2026-07-22T10:02:00.000Z'
    const launching: UpdateAttempt = {
      sourceVersion: '1.1.1',
      targetVersion: '1.2.3-beta.1',
      status: 'launching',
      error: 'old diagnostic',
    }

    expect(reconcile(launching, '1.2.3-beta.1', timestamp)).toEqual({
      sourceVersion: '1.1.1',
      targetVersion: '1.2.3-beta.1',
      status: 'installed',
      updatedAt: timestamp,
      completedAt: timestamp,
    })
    expect(reconcile(launching, '1.2.3-beta.2', timestamp)?.status).toBe('installed')
    expect(reconcile(launching, '1.2.3', timestamp)?.status).toBe('installed')
    expect(reconcile(launching, '2.0.0', timestamp)?.status).toBe('installed')
  })

  it('marks a launching attempt as interrupted when the target was not installed', () => {
    const launching: UpdateAttempt = {
      sourceVersion: '1.1.1',
      targetVersion: '1.2.3',
      status: 'launching',
      startedAt: '2026-07-22T10:01:00.000Z',
    }
    const timestamp = '2026-07-22T10:03:00.000Z'

    const result = reconcile(launching, '1.2.3-beta.1', timestamp)

    expect(result).toEqual({
      ...launching,
      status: 'interrupted',
      updatedAt: timestamp,
      error: 'Update to 1.2.3 did not complete; current version is 1.2.3-beta.1',
    })
    expect(launching.status).toBe('launching')
  })

  it('leaves non-launching attempts unchanged when the target is not installed', () => {
    const downloaded: UpdateAttempt = { targetVersion: '1.2.3', status: 'downloaded' }
    const failed: UpdateAttempt = { targetVersion: '1.2.3', status: 'failed', error: 'spawn failed' }

    expect(reconcile(downloaded, '1.2.2')).toBe(downloaded)
    expect(reconcile(failed, 'invalid-current-version')).toBe(failed)
    expect(reconcile(null, '1.2.3')).toBeNull()
  })

  it('rejects invalid attempts before writing', () => {
    const filePath = createStatePath()

    expect(() => write(filePath, { targetVersion: '01.2.3', status: 'downloaded' })).toThrow(
      'Invalid update attempt'
    )
    expect(existsSync(filePath)).toBe(false)
  })
})
