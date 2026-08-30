import path from 'path'

export type UserDataProfileKind = 'explicit' | 'development' | 'tooling' | 'production'

export interface UserDataProfile {
  kind: UserDataProfileKind
  path: string
  shouldMigrateLegacyData: boolean
}

export interface UserDataProfileOptions {
  appDataPath: string
  cwd: string
  argv: readonly string[]
  env: Readonly<Record<string, string | undefined>>
  isPackaged: boolean
}

const USER_DATA_ARGUMENT = '--user-data-dir'
const USER_DATA_ENVIRONMENT_VARIABLE = 'CREDVAULTIX_USER_DATA_DIR'

function normalizeExplicitPath(value: string | undefined, cwd: string) {
  const normalized = value?.trim()
  return normalized ? path.resolve(cwd, normalized) : null
}

function getCommandLineUserDataPath(argv: readonly string[], cwd: string) {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument.startsWith(`${USER_DATA_ARGUMENT}=`)) {
      const resolved = normalizeExplicitPath(argument.slice(USER_DATA_ARGUMENT.length + 1), cwd)
      if (resolved) return resolved
      continue
    }

    if (argument === USER_DATA_ARGUMENT) {
      const nextArgument = argv[index + 1]
      if (nextArgument && !nextArgument.startsWith('--')) {
        const resolved = normalizeExplicitPath(nextArgument, cwd)
        if (resolved) return resolved
      }
    }
  }

  return null
}

function hasCodexToolingMarker(env: UserDataProfileOptions['env']) {
  const identifierMarkers = [
    env.CODEX_SESSION_ID,
    env.CODEX_THREAD_ID,
    env.CODEX_APP_TOOLS_PIPE_PATH,
    env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE,
  ]
  if (identifierMarkers.some((value) => Boolean(value?.trim()))) return true

  return [env.CODEX_SHELL, env.CODEX_CI].some((value) => {
    const normalized = value?.trim().toLowerCase()
    return Boolean(normalized && !['0', 'false', 'no', 'off'].includes(normalized))
  })
}

export function resolveUserDataProfile(options: UserDataProfileOptions): UserDataProfile {
  const commandLinePath = getCommandLineUserDataPath(options.argv, options.cwd)
  const environmentPath = normalizeExplicitPath(
    options.env[USER_DATA_ENVIRONMENT_VARIABLE],
    options.cwd
  )
  const explicitPath = commandLinePath || environmentPath

  if (explicitPath) {
    return {
      kind: 'explicit',
      path: explicitPath,
      shouldMigrateLegacyData: false,
    }
  }

  if (!options.isPackaged) {
    return {
      kind: 'development',
      path: path.join(options.appDataPath, 'CredVaultix-Development'),
      shouldMigrateLegacyData: false,
    }
  }

  if (hasCodexToolingMarker(options.env)) {
    return {
      kind: 'tooling',
      path: path.join(options.appDataPath, 'CredVaultix-Tooling'),
      shouldMigrateLegacyData: false,
    }
  }

  return {
    kind: 'production',
    path: path.join(options.appDataPath, 'CredVaultix'),
    shouldMigrateLegacyData: true,
  }
}
