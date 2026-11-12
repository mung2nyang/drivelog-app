import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { parseDateKeySelection } from './calendar.ts'

describe('parseDateKeySelection — /app/day/:date 라우트 파라미터 계약', () => {
  test('date가 없으면(=index 라우트, "/app") null — MainPage가 달력을 그린다', () => {
    assert.equal(parseDateKeySelection(undefined), null)
  })

  test('형식이 안 맞는 값도 null로 떨어진다(깨진 URL로 일지가 잘못 열리지 않는다)', () => {
    assert.equal(parseDateKeySelection(''), null)
    assert.equal(parseDateKeySelection('2026-8-1'), null)
    assert.equal(parseDateKeySelection('not-a-date'), null)
  })

  test('유효한 YYYY-MM-DD는 month/day를 정확히 뽑는다', () => {
    assert.deepEqual(parseDateKeySelection('2026-08-26'), { dateKey: '2026-08-26', month: 8, day: 26 })
    assert.deepEqual(parseDateKeySelection('2026-01-01'), { dateKey: '2026-01-01', month: 1, day: 1 })
    assert.deepEqual(parseDateKeySelection('2026-12-31'), { dateKey: '2026-12-31', month: 12, day: 31 })
  })
})
