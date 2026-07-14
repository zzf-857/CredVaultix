import { readFileSync, writeFileSync } from 'node:fs'

const version = String(process.argv[2] || '').replace(/^v/, '')
const outputPath = process.argv[3] || 'release-notes.md'
if (!version) {
  console.error('Usage: node scripts/extract-release-notes.mjs <version-or-tag> [output]')
  process.exit(1)
}

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
const lines = changelog.split(/\r?\n/)
const start = lines.findIndex((line) => line.startsWith(`## [${version}]`) || line.startsWith(`## ${version} `))
if (start < 0) {
  console.error(`CHANGELOG.md 中没有找到 ${version}`)
  process.exit(1)
}

let end = lines.length
for (let index = start + 1; index < lines.length; index += 1) {
  if (lines[index].startsWith('## ')) {
    end = index
    break
  }
}

const notes = `${lines.slice(start, end).join('\n').trim()}\n`
writeFileSync(outputPath, notes, 'utf8')
console.log(`release notes: ${outputPath}`)
