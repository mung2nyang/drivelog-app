import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { searchParamsForViewDate, viewDateFromSearchParams } from './calendarViewDate.ts'

describe('viewDateFromSearchParams / searchParamsForViewDate — 달력 월 URL 왕복', () => {
  test('유효한 y/m 쿼리는 그 연/월의 1일로 해석된다', () => {
    const params = new URLSearchParams({ y: '2026', m: '7' })
    const viewDate = viewDateFromSearchParams(params)
    assert.equal(viewDate.getFullYear(), 2026)
    assert.equal(viewDate.getMonth(), 7)
    assert.equal(viewDate.getDate(), 1)
  })

  test('쿼리가 없으면(직접 /app 진입) 오늘 날짜로 대체한다', () => {
    const viewDate = viewDateFromSearchParams(new URLSearchParams())
    const today = new Date()
    assert.equal(viewDate.getFullYear(), today.getFullYear())
    assert.equal(viewDate.getMonth(), today.getMonth())
  })

  test('범위를 벗어난 m(예: 12)이나 깨진 값도 오늘 날짜로 대체한다', () => {
    const today = new Date()
    const brokenM = viewDateFromSearchParams(new URLSearchParams({ y: '2026', m: '12' }))
    assert.equal(brokenM.getMonth(), today.getMonth())
    const notANumber = viewDateFromSearchParams(new URLSearchParams({ y: 'abc', m: '3' }))
    assert.equal(notANumber.getFullYear(), today.getFullYear())
  })

  test('searchParamsForViewDate가 만든 값을 다시 넣으면 같은 달로 되돌아온다(왕복)', () => {
    const original = new Date(2025, 0, 15)
    const params = new URLSearchParams(searchParamsForViewDate(original))
    const roundTripped = viewDateFromSearchParams(params)
    assert.equal(roundTripped.getFullYear(), 2025)
    assert.equal(roundTripped.getMonth(), 0)
  })
})
