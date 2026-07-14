import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyReleaseAssets } from './verify-release-assets.mjs'

const temporaryDirectories = []

function createFixture({ declaredSizeOffset = 0, declaredSha512 } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'credvaultix-release-assets-'))
  temporaryDirectories.push(root)
  const releaseDirectory = path.join(root, 'release')
  const packageJsonPath = path.join(root, 'package.json')
  const version = '9.8.7'
  const installerName = `CredVaultix-Setup-${version}.exe`
  const installer = Buffer.from('deterministic installer fixture')
  const sha512 = createHash('sha512').update(installer).digest('base64')

  mkdirSync(releaseDirectory)
  writeFileSync(packageJsonPath, JSON.stringify({ version }))
  writeFileSync(path.join(releaseDirectory, installerName), installer)
  writeFileSync(path.join(releaseDirectory, `${installerName}.blockmap`), 'blockmap')
  writeFileSync(path.join(releaseDirectory, 'latest.yml'), [
    `version: ${version}`,
    'files:',
    `  - url: ${installerName}`,
    `    sha512: ${declaredSha512 || sha512}`,
    `    size: ${installer.length + declaredSizeOffset}`,
    `path: ${installerName}`,
    `sha512: ${declaredSha512 || sha512}`,
    "releaseDate: '2026-07-14T00:00:00.000Z'",
    '',
  ].join('\n'))

  return { releaseDirectory, packageJsonPath, installer, sha512 }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('release asset verification', () => {
  it('accepts matching installer size and SHA-512 metadata', () => {
    const fixture = createFixture()
    const result = verifyReleaseAssets(fixture)

    expect(result.version).toBe('9.8.7')
    expect(result.installerSize).toBe(fixture.installer.length)
    expect(result.sha512).toBe(fixture.sha512)
  })

  it('rejects stale updater size or hash metadata', () => {
    const staleSize = createFixture({ declaredSizeOffset: 1 })
    expect(() => verifyReleaseAssets(staleSize)).toThrow('files[0].size')

    const staleHash = createFixture({ declaredSha512: 'stale-sha512' })
    expect(() => verifyReleaseAssets(staleHash)).toThrow('sha512')
  })
})
