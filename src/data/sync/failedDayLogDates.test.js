import '../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'
import { addFailedDayLogDate, getFailedDayLogPatch, listFailedDayLogDates, removeFailedDayLogDate, subscribeFailedDayLogDates } from './failedDayLogDates.ts'

const KEY = 'drivelogFailedDayLogDates'
beforeEach(() => { localStorage.removeItem(KEY) })

test('더하기는 한 번만, 지우기는 그 차량·날짜만', () => {
  addFailedDayLogDate('own-a', 'main', '2026-10-22')
  addFailedDayLogDate('own-a', 'main', '2026-10-22')
  addFailedDayLogDate('own-a', '34나5678', '2026-10-22')
  addFailedDayLogDate('own-a', 'main', '2026-10-23')
  assert.deepEqual(listFailedDayLogDates('own-a'), [
    { logId: 'main', dateKey: '2026-10-22' },
    { logId: '34나5678', dateKey: '2026-10-22' },
    { logId: 'main', dateKey: '2026-10-23' },
  ])
  removeFailedDayLogDate('own-a', 'main', '2026-10-22')
  assert.deepEqual(listFailedDayLogDates('own-a'), [
    { logId: '34나5678', dateKey: '2026-10-22' },
    { logId: 'main', dateKey: '2026-10-23' },
  ])
})

test('계정마다 따로, 휴대폰에 남아 다시 읽어도 그대로', () => {
  addFailedDayLogDate('own-a', 'main', '2026-10-22')
  addFailedDayLogDate('own-b', 'main', '2026-10-21')
  assert.deepEqual(listFailedDayLogDates('own-b'), [{ logId: 'main', dateKey: '2026-10-21' }])
  assert.deepEqual(JSON.parse(localStorage.getItem(KEY) || '{}'), {
    'own-a': [{ logId: 'main', dateKey: '2026-10-22' }],
    'own-b': [{ logId: 'main', dateKey: '2026-10-21' }],
  })
})

test('깨진 값은 그 항목·목록만 무시', () => {
  localStorage.setItem(KEY, JSON.stringify({
    'own-a': [{ logId: 'main', dateKey: '2026-10-22' }, { logId: 'main', dateKey: '2026-02-30' }, { logId: 3, dateKey: '2026-10-22' }, null, 'x'],
    'own-b': 'not-array',
  }))
  assert.deepEqual(listFailedDayLogDates('own-a'), [{ logId: 'main', dateKey: '2026-10-22' }])
  assert.deepEqual(listFailedDayLogDates('own-b'), [])
  localStorage.setItem(KEY, '{')
  assert.deepEqual(listFailedDayLogDates('own-a'), [])
  localStorage.setItem(KEY, '[1]')
  assert.deepEqual(listFailedDayLogDates('own-a'), [])
})

test('휴대폰 저장소를 못 써도 던지지 않는다', () => {
  const getItem = mock.method(Object.getPrototypeOf(localStorage), 'getItem', () => { throw new Error('막힘') })
  const setItem = mock.method(Object.getPrototypeOf(localStorage), 'setItem', () => { throw new Error('막힘') })
  try {
    assert.doesNotThrow(() => addFailedDayLogDate('own-a', 'main', '2026-10-22'))
    assert.doesNotThrow(() => removeFailedDayLogDate('own-a', 'main', '2026-10-22'))
    assert.deepEqual(listFailedDayLogDates('own-a'), [])
  } finally {
    getItem.mock.restore()
    setItem.mock.restore()
  }
})

test('바뀔 때만 구독자를 부르고, 해제하면 안 부른다', () => {
  let calls = 0
  const stop = subscribeFailedDayLogDates(() => { calls += 1 })
  addFailedDayLogDate('own-a', 'main', '2026-10-22')
  addFailedDayLogDate('own-a', 'main', '2026-10-22')
  removeFailedDayLogDate('own-a', 'main', '2026-10-21')
  removeFailedDayLogDate('own-a', 'main', '2026-10-22')
  assert.equal(calls, 2)
  stop()
  addFailedDayLogDate('own-a', 'main', '2026-10-23')
  assert.equal(calls, 2)
})

/** @param {number} fixedCount */
function patchOf(fixedCount) {
  return { isOff: false, fixedCount, palletCount: 0, callDetails: [], fixedRouteCounts: {} }
}

test('내용도 남기고 읽는다, 같은 날 다시 실패하면 마지막 내용으로, 목록은 날짜만 돌려준다', () => {
  addFailedDayLogDate('own-p', 'main', '2026-11-01', patchOf(1))
  addFailedDayLogDate('own-p', 'main', '2026-11-01', patchOf(2))
  addFailedDayLogDate('own-p', 'main', '2026-11-01')
  assert.deepEqual(getFailedDayLogPatch('own-p', 'main', '2026-11-01'), patchOf(2), '내용 없이 다시 더해도 남은 내용 그대로')
  assert.deepEqual(listFailedDayLogDates('own-p'), [{ logId: 'main', dateKey: '2026-11-01' }])
  assert.equal(getFailedDayLogPatch('own-p', '34나5678', '2026-11-01'), undefined)
  assert.equal(getFailedDayLogPatch('own-other', 'main', '2026-11-01'), undefined, '다른 계정엔 안 보임')
  removeFailedDayLogDate('own-p', 'main', '2026-11-01')
  assert.equal(getFailedDayLogPatch('own-p', 'main', '2026-11-01'), undefined)
})

test('날짜만 있던 항목에 내용이 생기면 그 자리에서 바뀐다', () => {
  addFailedDayLogDate('own-q', 'main', '2026-11-02')
  addFailedDayLogDate('own-q', 'main', '2026-11-03')
  addFailedDayLogDate('own-q', 'main', '2026-11-02', patchOf(5))
  assert.deepEqual(listFailedDayLogDates('own-q'), [
    { logId: 'main', dateKey: '2026-11-02' },
    { logId: 'main', dateKey: '2026-11-03' },
  ])
  assert.equal(getFailedDayLogPatch('own-q', 'main', '2026-11-02')?.fixedCount, 5)
})

test('손상된 내용은 쓰지 않고 날짜만 있는 항목처럼', () => {
  const broken = [[], null, 'x', 3, {}, { ...patchOf(1), fixedCount: -1 }, { ...patchOf(1), callDetails: [{ fare: 'x' }] }, { ...patchOf(1), fixedRouteCounts: [] }]
  localStorage.setItem(KEY, JSON.stringify({ 'own-r': broken.map((patch, i) => ({ logId: 'main', dateKey: `2026-11-${String(i + 10)}`, patch })) }))
  assert.equal(listFailedDayLogDates('own-r').length, broken.length, '날짜는 남음')
  broken.forEach((item, i) => {
    assert.equal(getFailedDayLogPatch('own-r', 'main', `2026-11-${String(i + 10)}`), undefined, JSON.stringify(item))
  })
})

test('목록 원문이 통째로 깨졌으면 더하기·지우기가 덮어쓰지 않는다', () => {
  for (const raw of ['{', '[1]', 'null', '"x"']) {
    localStorage.setItem(KEY, raw)
    addFailedDayLogDate('own-s', 'main', '2026-11-04', patchOf(1))
    removeFailedDayLogDate('own-s', 'main', '2026-11-04')
    assert.equal(localStorage.getItem(KEY), raw, raw)
    assert.equal(getFailedDayLogPatch('own-s', 'main', '2026-11-04'), undefined)
  }
})
