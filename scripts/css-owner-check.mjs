import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'src')

const ALLOWED = {
}

function cssFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return cssFiles(full)
    return entry.name.endsWith('.css') ? [full] : []
  })
}

function areaOf(file) {
  const parts = file.split('/')
  return parts[1] === 'features' ? parts.slice(0, 3).join('/') : '공용'
}

function leadingClasses(css) {
  const found = new Set()
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const match of text.matchAll(/([^{}]+)\{/g)) {
    const selector = match[1].trim()
    if (!selector || selector.startsWith('@') || /^(from|to|\d+(\.\d+)?%)\b/.test(selector)) continue
    for (const part of selector.split(',')) {
      const bare = part.trim().replace(/^(?::root|html|body|\[[^\]]*\])+\s*/, '')
      const name = bare.match(/^\.([A-Za-z0-9_-]+)/)
      if (name) found.add(name[1])
    }
  }
  return found
}

const owners = new Map()
for (const full of cssFiles(SRC)) {
  const file = path.relative(ROOT, full).split(path.sep).join('/')
  for (const name of leadingClasses(fs.readFileSync(full, 'utf8'))) {
    if (!owners.has(name)) owners.set(name, [])
    owners.get(name).push(file)
  }
}

const problems = []
for (const [name, files] of owners) {
  const crosses = new Set(files.map(areaOf)).size > 1
  const allowed = ALLOWED[name]
  if (!allowed) {
    if (crosses) problems.push(`.${name} — 두 구역에서 정의: ${files.join(', ')}`)
    continue
  }
  const extra = files.filter((file) => !allowed.includes(file))
  if (extra.length) problems.push(`.${name} — 예외 목록에 없는 파일에서 또 정의: ${extra.join(', ')}`)
  else if (!crosses) problems.push(`.${name} — 더는 겹치지 않음, scripts/css-owner-check.mjs 예외 목록에서 지우세요`)
}
for (const name of Object.keys(ALLOWED)) {
  if (!owners.has(name)) problems.push(`.${name} — CSS에 없음, scripts/css-owner-check.mjs 예외 목록에서 지우세요`)
}

if (problems.length) {
  console.error(`CSS 이름표 구역 검사 실패 ${problems.length}건:\n${problems.map((line) => `  ${line}`).join('\n')}`)
  process.exit(1)
}
console.log(`CSS 이름표 구역 검사 통과 — 이름표 ${owners.size}개, 예외 ${Object.keys(ALLOWED).length}개`)
