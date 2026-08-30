import path from 'path'
import { describe, expect, it } from 'vitest'
import { type UserDataProfileOptions, resolveUserDataProfile } from './userDataProfile'

const appDataPath = path.resolve('test-app-data')
const cwd = path.resolve('test-workspace')

function resolve(overrides: Partial<UserDataProfileOptions> = {}) {
  return resolveUserDataProfile({
    appDataPath,
    cwd,
    argv: ['electron', '.'],
    env: {},
    isPackaged: true,
    ...overrides,
  })
}

describe('resolveUserDataProfile', () => {
  it('uses the command-line directory before every other profile', () => {
    const commandLinePath = path.resolve('command-line-data')

    expect(resolve({
      argv: ['CredVaultix.exe', `--user-data-dir=${commandLinePath}`],
      env: {
        CREDVAULTIX_USER_DATA_DIR: path.resolve('environment-data'),
        CODEX_SESSION_ID: 'tooling-session',
      },
      isPackaged: false,
    })).toEqual({
      kind: 'explicit',
      path: commandLinePath,
      shouldMigrateLegacyData: false,
    })
  })

  it('supports the split command-line form and resolves relative paths from cwd', () => {
    expect(resolve({ argv: ['CredVaultix.exe', '--user-data-dir', 'isolated-data'] })).toEqual({
      kind: 'explicit',
      path: path.resolve(cwd, 'isolated-data'),
      shouldMigrateLegacyData: false,
    })
  })

  it('falls back to the explicit environment directory when the argument is absent or blank', () => {
    expect(resolve({
      argv: ['CredVaultix.exe', '--user-data-dir=   '],
      env: { CREDVAULTIX_USER_DATA_DIR: 'environment-data' },
    })).toEqual({
      kind: 'explicit',
      path: path.resolve(cwd, 'environment-data'),
      shouldMigrateLegacyData: false,
    })
  })

  it('isolates development data even when launched from Codex', () => {
    expect(resolve({
      env: { CODEX_SESSION_ID: 'tooling-session' },
      isPackaged: false,
    })).toEqual({
      kind: 'development',
      path: path.join(appDataPath, 'CredVaultix-Development'),
      shouldMigrateLegacyData: false,
    })
  })

  it.each([
    ['session id', { CODEX_SESSION_ID: 'session-id' }],
    ['thread id', { CODEX_THREAD_ID: 'thread-id' }],
    ['tool pipe', { CODEX_APP_TOOLS_PIPE_PATH: 'tool-pipe' }],
    ['shell marker', { CODEX_SHELL: '1' }],
    ['CI marker', { CODEX_CI: 'true' }],
  ])('isolates packaged Codex tooling data when detected by %s', (_label, env) => {
    expect(resolve({ env })).toEqual({
      kind: 'tooling',
      path: path.join(appDataPath, 'CredVaultix-Tooling'),
      shouldMigrateLegacyData: false,
    })
  })

  it('ignores disabled Codex boolean markers', () => {
    expect(resolve({ env: { CODEX_SHELL: '0', CODEX_CI: 'false' } })).toEqual({
      kind: 'production',
      path: path.join(appDataPath, 'CredVaultix'),
      shouldMigrateLegacyData: true,
    })
  })

  it('uses the production profile and permits legacy migration only in production', () => {
    expect(resolve()).toEqual({
      kind: 'production',
      path: path.join(appDataPath, 'CredVaultix'),
      shouldMigrateLegacyData: true,
    })
  })
})
