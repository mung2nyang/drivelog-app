// CSS 규칙 맨 앞 이름표가 두 구역(공용, 기능 폴더마다)에서 정의되면 실패한다 — 예외는 아래 목록만.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'src')

/** 이미 겹쳐 있던 이름표 → 허용 파일. 정리하면 여기서 지운다. */
const ALLOWED = {
  'app-settings-page': ['src/features/settings/ui/app-settings-groups.css', 'src/shared/styles/management-common.css', 'src/shared/styles/modal-form.css'],
  'car-modal': ['src/features/cars/ui/car-management.css', 'src/shared/styles/modal-form.css'],
  'maint-fuel-page': ['src/features/expenses/ui/maint-fuel.css', 'src/shared/styles/management-common.css'],
  'management-badge': ['src/features/receivables/ui/receivables.css', 'src/shared/styles/management-common.css'],
  'management-list-card': ['src/features/cars/ui/car-management.css', 'src/shared/styles/management-common.css'],
  'message-settings-textarea': ['src/features/settings/ui/message-settings.css', 'src/shared/styles/modal-form.css'],
  'modal-content': ['src/features/expenses/ui/expense-form.css', 'src/shared/styles/controls-common.css', 'src/shared/styles/modal-base.css'],
  'personal-info-page': ['src/features/account/ui/PersonalInfoPage.css', 'src/shared/styles/management-common.css', 'src/shared/styles/modal-form.css'],
  'receivables-page': ['src/features/receivables/ui/receivables.css', 'src/shared/styles/management-common.css'],
  'report-page-wrap': ['src/features/documents/ui/report.css', 'src/shared/styles/management-common.css'],
  'revenue-detail-head': ['src/features/revenue/ui/revenue.css', 'src/shared/styles/app-shell-base.css'],
  'setting-item': ['src/features/settings/ui/app-settings.css', 'src/shared/styles/controls-common.css'],
  'toggle-btn': ['src/features/day-log/ui/day-log-shell.css', 'src/shared/styles/controls-common.css', 'src/shared/styles/shared-controls.css'],
}

function cssFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return cssFiles(full)
    return entry.name.endsWith('.css') ? [full] : []
  })
}

/** 공용은 src/shared·src/app 한 구역, 기능은 src/features/<이름>마다 한 구역. */
function areaOf(file) {
  const parts = file.split('/')
  return parts[1] === 'features' ? parts.slice(0, 3).join('/') : '공용'
}

/** 규칙 선택자마다 맨 앞 이름표 — 테마 앞붙이([data-theme]·:root·html·body)는 건너뛰고 @규칙 머리·키프레임 단계는 뺀다. */
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
