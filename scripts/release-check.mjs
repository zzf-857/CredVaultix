import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const tagIndex = args.indexOf('--tag')
const suppliedTag = tagIndex >= 0 ? args[tagIndex + 1] : process.env.GITHUB_REF_NAME
const allowDirty = args.includes('--allow-dirty')

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const packageLock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
const version = String(packageJson.version || '')
const expectedTag = `v${version}`

function fail(message) {
  console.error(`release-check: ${message}`)
  process.exit(1)
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`package.json 版本号不是有效 SemVer：${version}`)
}

if (packageLock.version !== version || packageLock.packages?.['']?.version !== version) {
  fail(`package-lock.json 版本与 package.json 不一致（期望 ${version}）`)
}

if (suppliedTag && suppliedTag !== expectedTag) {
  fail(`标签 ${suppliedTag} 与 package.json 版本不一致，期望 ${expectedTag}`)
}

const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const changelogHeading = new RegExp(`^## \\[?${escapedVersion}\\]?\\s+-\\s+\\d{4}-\\d{2}-\\d{2}$`, 'm')
if (suppliedTag && !changelogHeading.test(changelog)) {
  fail(`CHANGELOG.md 缺少 ${version} 的带日期发布章节`)
}

if (!allowDirty && process.env.GITHUB_ACTIONS !== 'true') {
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' }).trim()
  if (status) fail('工作区不干净，请先提交或暂存无关修改')
}

if (suppliedTag && process.env.GITHUB_ACTIONS === 'true') {
  let objectType = ''
  try {
    objectType = execFileSync('git', ['cat-file', '-t', suppliedTag], { encoding: 'utf8' }).trim()
  } catch {
    fail(`无法读取标签 ${suppliedTag}`)
  }
  if (objectType !== 'tag') {
    fail(`${suppliedTag} 不是 annotated tag；请使用 git tag -a 创建发布标签`)
  }
}

console.log(`release-check: ${expectedTag} 配置一致`)
