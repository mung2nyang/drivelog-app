// 금지 타입 표기 검사 — any를 타입으로 쓴 줄이 있으면 실패한다.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'src')
const BANNED = /\bany\b/
/** 주석 속 타입 자리: @type {…} 같은 태그 뒤 중괄호. */
const JSDOC_TAG = /@(?:type|param|returns?|typedef|property|prop|satisfies|this|throws|template)\s*\{/g
/** TS 코드 속 타입 자리: `: any`, `as any`, `<any`, `any[]`, `| any`, `, any>` */
const TS_ANY = /:\s*any\b|\bas\s+any\b|<\s*any\b|\bany\s*\[\]|\|\s*any\b|,\s*any\s*[>,)]/g
/** 문자열·주석 — TS 코드 검사 전에 같은 길이 빈칸으로 바꿔 줄 번호를 지킨다. */
const STRING_OR_COMMENT = /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [full] : []
  })
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length

/** 태그 뒤 중괄호 짝을 맞춰 속 글자를 꺼낸다. */
function braceBody(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1
    else if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i)
  }
  return text.slice(open + 1)
}

const problems = []
for (const full of sourceFiles(SRC)) {
  const file = path.relative(ROOT, full).split(path.sep).join('/')
  const text = fs.readFileSync(full, 'utf8')
  for (const match of text.matchAll(JSDOC_TAG)) {
    const open = match.index + match[0].length - 1
    if (BANNED.test(braceBody(text, open))) problems.push(`${file}:${lineOf(text, match.index)} 주석 속 타입에 any`)
  }
  if (!/\.tsx?$/.test(file)) continue
  const code = text.replace(STRING_OR_COMMENT, (part) => part.replace(/[^\n]/g, ' '))
  for (const match of code.matchAll(TS_ANY)) problems.push(`${file}:${lineOf(code, match.index)} 코드 속 타입에 any`)
}

if (problems.length) {
  console.error(`금지 타입 표기 검사 실패 ${problems.length}건:\n${problems.map((line) => `  ${line}`).join('\n')}`)
  process.exit(1)
}
console.log('금지 타입 표기 검사 통과 — any 0건')
