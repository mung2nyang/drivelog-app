import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))

test('일지 인라인 호스트는 max-height:0 + is-open 트릭을 쓰지 않는다', () => {
  const dayLog = readFileSync(join(here, 'day-log.css'), 'utf8')
  assert.match(dayLog, /\.inline-sheet\.is-visible/)
  assert.match(dayLog, /\.inline-sheet\.is-visible\s*\{[^}]*grid-template-rows:\s*1fr/)
  assert.match(dayLog, /min-height:\s*min-content/)
  assert.match(dayLog, /scroll-padding-bottom/)
  assert.equal(/inline-sheet-panel[\s\S]{0,180}max-height:\s*calc\(100dvh/.test(dayLog), false)
  assert.equal(dayLog.includes('scrollIntoView'), false)
})

test('일지 인라인 시트의 취소/저장 액션 바는 sticky/fixed가 아니라 일반 문서 흐름이다', () => {
  const dayLog = readFileSync(join(here, 'day-log.css'), 'utf8')
  const actionsBlockMatch = dayLog.match(/\.call-detail-form-actions,[\s\S]*?\.modal-btns\s*\{([\s\S]*?)\}/)
  assert.ok(actionsBlockMatch, '취소/저장 액션 바 규칙을 day-log.css에서 찾지 못했다')
  const actionsBlock = actionsBlockMatch[1]
  assert.equal(/position:\s*sticky/.test(actionsBlock), false)
  assert.equal(/position:\s*fixed/.test(actionsBlock), false)
})

test('InlineSheet: 자동 스크롤은 펼쳐짐이 끝난 뒤에만, useLayoutEffect는 쓰지 않는다', () => {
  const source = readFileSync(join(here, 'InlineSheet.jsx'), 'utf8')
  assert.equal(source.includes('useLayoutEffect'), false)
  assert.match(source, /scrollIntoView\(\{ block: 'start'/)
})
