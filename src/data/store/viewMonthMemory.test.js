// 달력·매출 보던 달 기억: 화면별·계정별, 앱을 다시 켜면(기억 비움) 없음.
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { forgetViewMonths, recallViewMonth, rememberViewMonth } from './viewMonthMemory.ts'

beforeEach(() => { forgetViewMonths() })

test('기억한 달을 그 달 1일로 돌려준다, 매출은 년 매출 탭인지도', () => {
  rememberViewMonth('calendar', 'owner-a', new Date(2026, 9, 17))
  rememberViewMonth('revenue', 'owner-a', new Date(2025, 2, 1), true)
  const calendar = recallViewMonth('calendar', 'owner-a')
  assert.deepEqual([calendar?.viewDate.getFullYear(), calendar?.viewDate.getMonth(), calendar?.viewDate.getDate(), calendar?.yearly], [2026, 9, 1, false])
  const revenue = recallViewMonth('revenue', 'owner-a')
  assert.deepEqual([revenue?.viewDate.getFullYear(), revenue?.viewDate.getMonth(), revenue?.yearly], [2025, 2, true])
})

test('달력과 매출은 따로, 다른 계정이면 없음', () => {
  rememberViewMonth('calendar', 'owner-a', new Date(2026, 9, 1))
  assert.equal(recallViewMonth('revenue', 'owner-a'), null)
  assert.equal(recallViewMonth('calendar', 'owner-b'), null)
})

test('기억이 없으면(앱을 다시 켬) null', () => {
  assert.equal(recallViewMonth('calendar', 'owner-a'), null)
  rememberViewMonth('calendar', 'owner-a', new Date(2026, 9, 1))
  forgetViewMonths()
  assert.equal(recallViewMonth('calendar', 'owner-a'), null)
})
