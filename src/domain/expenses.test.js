import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { FUEL_TYPES, dedupeExpensesById, expenseTitle, fuelAmountUnit, groupExpensesByDate } from './expenses.ts'

describe('정비/기타 저장 조건', () => {
  test('날짜별로 묶어 하루 합계를 낸다', () => {
    const groups = groupExpensesByDate([
      { id: '2', date: '2026-08-02', cost: 1000 },
      { id: '1a', date: '2026-08-01', cost: 3000 },
      { id: '1b', date: '2026-08-01', cost: 2000 },
    ])
    assert.equal(groups.length, 2)
    assert.equal(groups[0].date, '2026-08-01')
    assert.equal(groups[0].dailyTotal, 5000)
    assert.equal(groups[0].items.length, 2)
    assert.equal(groups[1].date, '2026-08-02')
  })

  test('같은 id는 한 줄만 남긴다', () => {
    const next = dedupeExpensesById([
      { id: 'a', kind: 'fuel', date: '2026-08-01', cost: 1 },
      { id: 'a', kind: 'fuel', date: '2026-08-01', cost: 2 },
      { id: 'b', kind: 'maint', date: '2026-08-01', cost: 3 },
    ])
    assert.equal(next.length, 2)
    assert.equal(next[0].cost, 1)
    assert.equal(next[1].id, 'b')
  })
})

describe('주유 종류 전기와 양 단위', () => {
  test('종류 칩은 주유·요소수·전기·기타 순서', () => {
    assert.deepEqual(FUEL_TYPES, ['주유', '요소수', '전기', '기타'])
  })

  test('전기는 kWh, 나머지(빈 값 포함)는 L', () => {
    assert.equal(fuelAmountUnit('전기'), 'kWh')
    assert.equal(fuelAmountUnit('주유'), 'L')
    assert.equal(fuelAmountUnit('요소수'), 'L')
    assert.equal(fuelAmountUnit(undefined), 'L')
  })

  test('목록 제목: 전기는 "전기 (35kWh)", 주유는 "주유 (40L)" 그대로, 양이 0이면 종류만', () => {
    assert.equal(expenseTitle({ id: 'e', kind: 'fuel', date: '2026-11-09', fuelType: '전기', liters: 35 }), '전기 (35kWh)')
    assert.equal(expenseTitle({ id: 'f', kind: 'fuel', date: '2026-11-09', fuelType: '주유', liters: 40 }), '주유 (40L)')
    assert.equal(expenseTitle({ id: 'g', kind: 'fuel', date: '2026-11-09', fuelType: '전기', liters: 0 }), '전기')
  })
})
