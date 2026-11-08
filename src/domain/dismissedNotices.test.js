// 닫은 알림 id 목록: 정리(목록 아님·빈칸·겹침·200개), 더하기(맨 뒤·이미 있음·지난 날짜 "오늘 일지 없음" 빼기·여러 개·200개).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addDismissedNotices, DISMISSED_NOTICES_MAX, normalizeDismissedNotices } from './dismissedNotices.ts'

const many = (/** @type {number} */ count) => Array.from({ length: count }, (_, index) => `overdue:main:2026-10-01:${index}`)

test('최대 200개', () => {
  assert.equal(DISMISSED_NOTICES_MAX, 200)
})

test('정리: 목록이 아니면 빈 목록, 글자만·앞뒤 빈칸 지움·빈 것과 겹친 것 뺌, 200개 넘으면 마지막 200개', () => {
  for (const value of [undefined, null, 'x', 3, {}]) assert.deepEqual(normalizeDismissedNotices(/** @type {never} */ (value)), [], JSON.stringify(value))
  assert.deepEqual(normalizeDismissedNotices([' driver:d1 ', '', 'driver:d1', 5, '  ', 'today:2026-11-08']), ['driver:d1', 'today:2026-11-08'])
  const kept = normalizeDismissedNotices(many(205))
  assert.equal(kept.length, 200)
  assert.equal(kept[0], 'overdue:main:2026-10-01:5', '오래된 앞 5개를 뺌')
  assert.equal(kept.at(-1), 'overdue:main:2026-10-01:204')
})

test('더하기: 새 id는 맨 뒤, 이미 있는 것은 그대로, 여러 개를 한 번에', () => {
  const next = addDismissedNotices({ dismissedNotices: ['driver:d1'] }, ['adminInquiry:q1', 'driver:d1', ' daily-inspection-required '], '2026-11-08')
  assert.deepEqual(next.dismissedNotices, ['driver:d1', 'adminInquiry:q1', 'daily-inspection-required'])
  assert.deepEqual(addDismissedNotices({}, ['driver:d2'], '2026-11-08').dismissedNotices, ['driver:d2'], '칸이 없던 설정')
})

test('더하기: 지난 날짜 "오늘 일지 없음"은 빼고 오늘 것만 남긴다', () => {
  const next = addDismissedNotices({ dismissedNotices: ['today:2026-11-06', 'driver:d1', 'today:2026-11-07'] }, ['today:2026-11-08', 'today:2026-11-05'], '2026-11-08')
  assert.deepEqual(next.dismissedNotices, ['driver:d1', 'today:2026-11-08'])
})

test('더하기: 200개가 넘으면 오래된 것부터 뺀다', () => {
  const next = addDismissedNotices({ dismissedNotices: many(200) }, ['driver:new'], '2026-11-08')
  assert.equal(next.dismissedNotices?.length, 200)
  assert.equal(next.dismissedNotices?.[0], 'overdue:main:2026-10-01:1')
  assert.equal(next.dismissedNotices?.at(-1), 'driver:new')
})
