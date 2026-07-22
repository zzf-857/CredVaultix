import { describe, expect, it } from 'vitest'
import mainWorkflow from '../../.github/workflows/main.yml?raw'
import releaseWorkflow from '../../.github/workflows/release.yml?raw'
import packageJsonText from '../../package.json?raw'

const packageJson = JSON.parse(packageJsonText)

describe('release automation configuration', () => {
  it('uses one tag-triggered release workflow without electron-builder auto publish', () => {
    expect(releaseWorkflow).toContain('tags:')
    expect(releaseWorkflow).toContain("'v*'")
    expect(releaseWorkflow).toContain('actions/checkout@v7')
    expect(releaseWorkflow).toContain('actions/setup-node@v7')
    expect(releaseWorkflow).toContain('node-version: 22.x')
    expect(releaseWorkflow).toContain('npm ci')
    expect(releaseWorkflow).toContain('npm run verify')
    expect(releaseWorkflow).toContain('npm run electron:build -- --publish never')
    expect(releaseWorkflow).toContain('npm run release:check')
    expect(releaseWorkflow).toContain('npm run release:assets')
    expect(releaseWorkflow).toContain('npm audit --audit-level=high')
    expect(releaseWorkflow).toContain('extract-release-notes.mjs')
    expect(releaseWorkflow).toContain('body_path: release-notes.md')
    expect(releaseWorkflow).toContain('actions/upload-artifact@v7')
    expect(releaseWorkflow).toContain('softprops/action-gh-release@v3')
    expect(releaseWorkflow).toContain('release/*.exe')
    expect(releaseWorkflow).toContain('release/*.blockmap')
    expect(releaseWorkflow).toContain('release/latest.yml')
    expect(releaseWorkflow).not.toContain('--publish always')

    expect(mainWorkflow).not.toContain("'v*'")
    expect(mainWorkflow).not.toContain('--publish always')
    expect(mainWorkflow).toContain('npm run verify')
    expect(mainWorkflow).toContain('node-version: 22.x')
    expect(mainWorkflow).toContain('npm audit --audit-level=high')
  })

  it('uses the CredVaultix product identity and publishes GitHub updater metadata', () => {
    expect(packageJson.name).toBe('credvaultix')
    expect(packageJson.build.productName).toBe('CredVaultix')
    expect(packageJson.build.appId).toBe('com.personal.credvaultix')
    expect(packageJson.build.directories.output).toBe('release')
    expect(packageJson.dependencies['electron-updater']).toBeDefined()
    expect(packageJson.build.publish).toEqual([
      {
        provider: 'github',
        owner: 'zzf-857',
        repo: 'CredVaultix',
      },
    ])
    expect(packageJson.build.win.artifactName).toBe('CredVaultix-${version}.${ext}')
    expect(packageJson.build.nsis.artifactName).toBe('CredVaultix-Setup-${version}.${ext}')
    expect(packageJson.build.nsis.shortcutName).toBe('CredVaultix')
    expect(packageJson.build.nsis.oneClick).toBe(false)
    expect(packageJson.build.nsis.allowElevation).toBe(true)
    expect(packageJson.build.nsis.packElevateHelper).toBe(true)
    expect(packageJson.engines.node).toBe('>=22.12.0')
    expect(packageJson.scripts['release:assets']).toBe('node scripts/verify-release-assets.mjs')
  })
})
