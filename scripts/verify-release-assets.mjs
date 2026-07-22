import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function readScalar(source, pattern, fieldName) {
  const match = source.match(pattern)
  if (!match) throw new Error(`latest.yml 缺少 ${fieldName}`)
  const value = match[1].trim()
  if (
    (value.startsWith("'") && value.endsWith("'"))
    || (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1)
  }
  return value
}

export function parseLatestMetadata(source) {
  return {
    version: readScalar(source, /^version:\s*(.+)$/m, 'version'),
    fileUrl: readScalar(source, /^\s{2}- url:\s*(.+)$/m, 'files[0].url'),
    fileSha512: readScalar(source, /^\s{4}sha512:\s*(.+)$/m, 'files[0].sha512'),
    fileSize: Number(readScalar(source, /^\s{4}size:\s*(\d+)\s*$/m, 'files[0].size')),
    path: readScalar(source, /^path:\s*(.+)$/m, 'path'),
    sha512: readScalar(source, /^sha512:\s*(.+)$/m, 'sha512'),
  }
}

export function verifyReleaseAssets({
  releaseDirectory,
  packageJsonPath,
} = {}) {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
  const projectDirectory = path.resolve(scriptDirectory, '..')
  const resolvedReleaseDirectory = path.resolve(releaseDirectory || path.join(projectDirectory, 'release'))
  const resolvedPackageJsonPath = path.resolve(packageJsonPath || path.join(projectDirectory, 'package.json'))
  const packageJson = JSON.parse(readFileSync(resolvedPackageJsonPath, 'utf8'))
  const version = String(packageJson.version || '')
  const installerName = `CredVaultix-Setup-${version}.exe`
  const installerPath = path.join(resolvedReleaseDirectory, installerName)
  const blockmapPath = `${installerPath}.blockmap`
  const latestPath = path.join(resolvedReleaseDirectory, 'latest.yml')
  const appUpdatePath = path.join(resolvedReleaseDirectory, 'win-unpacked', 'resources', 'app-update.yml')
  const elevatePath = path.join(resolvedReleaseDirectory, 'win-unpacked', 'resources', 'elevate.exe')

  const installerSize = statSync(installerPath).size
  const blockmapSize = statSync(blockmapPath).size
  const elevateSize = statSync(elevatePath).size
  if (installerSize <= 0) throw new Error(`安装包为空：${installerPath}`)
  if (blockmapSize <= 0) throw new Error(`blockmap 为空：${blockmapPath}`)
  if (elevateSize <= 0) throw new Error(`提权辅助程序为空：${elevatePath}`)

  const installerSha512 = createHash('sha512')
    .update(readFileSync(installerPath))
    .digest('base64')
  const metadata = parseLatestMetadata(readFileSync(latestPath, 'utf8'))
  const appUpdateSource = readFileSync(appUpdatePath, 'utf8')
  const appUpdate = {
    owner: readScalar(appUpdateSource, /^owner:\s*(.+)$/m, 'app-update.yml owner'),
    repo: readScalar(appUpdateSource, /^repo:\s*(.+)$/m, 'app-update.yml repo'),
    provider: readScalar(appUpdateSource, /^provider:\s*(.+)$/m, 'app-update.yml provider'),
    updaterCacheDirName: readScalar(
      appUpdateSource,
      /^updaterCacheDirName:\s*(.+)$/m,
      'app-update.yml updaterCacheDirName'
    ),
  }
  const githubPublish = packageJson.build?.publish?.find((entry) => entry?.provider === 'github')

  const mismatches = []
  if (metadata.version !== version) mismatches.push(`version=${metadata.version}，期望 ${version}`)
  if (metadata.fileUrl !== installerName) mismatches.push(`files[0].url=${metadata.fileUrl}，期望 ${installerName}`)
  if (metadata.path !== installerName) mismatches.push(`path=${metadata.path}，期望 ${installerName}`)
  if (metadata.fileSize !== installerSize) mismatches.push(`files[0].size=${metadata.fileSize}，期望 ${installerSize}`)
  if (metadata.fileSha512 !== installerSha512) mismatches.push('files[0].sha512 与安装包不一致')
  if (metadata.sha512 !== installerSha512) mismatches.push('sha512 与安装包不一致')
  if (!githubPublish) mismatches.push('package.json 缺少 GitHub publish 配置')
  if (appUpdate.provider !== 'github') mismatches.push(`app-update.yml provider=${appUpdate.provider}，期望 github`)
  if (githubPublish && appUpdate.owner !== githubPublish.owner) {
    mismatches.push(`app-update.yml owner=${appUpdate.owner}，期望 ${githubPublish.owner}`)
  }
  if (githubPublish && appUpdate.repo !== githubPublish.repo) {
    mismatches.push(`app-update.yml repo=${appUpdate.repo}，期望 ${githubPublish.repo}`)
  }
  if (appUpdate.updaterCacheDirName !== `${packageJson.name}-updater`) {
    mismatches.push(
      `app-update.yml updaterCacheDirName=${appUpdate.updaterCacheDirName}，期望 ${packageJson.name}-updater`
    )
  }

  if (mismatches.length > 0) {
    throw new Error(`发布元数据校验失败：\n- ${mismatches.join('\n- ')}`)
  }

  return {
    version,
    installerName,
    installerSize,
    blockmapSize,
    elevateSize,
    sha512: installerSha512,
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  try {
    const result = verifyReleaseAssets({ releaseDirectory: process.argv[2] })
    console.log(
      `release-assets: v${result.version} 校验通过（installer=${result.installerSize} bytes, blockmap=${result.blockmapSize} bytes, elevate=${result.elevateSize} bytes）`
    )
  } catch (error) {
    console.error(`release-assets: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
