import { resetStubSupabaseCallCounts, stubSupabaseCallCounts } from '../../testSupport/stubSupabaseClient.ts'
import '../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

const {
  registerPendingDayWrite, clearPendingDayWrite, getPendingDayWrite,
  hasPendingDayWrites, hasUnsafePendingWrites, pendingDayWriteCount, retryPendingDayWrites,
} = await import('./pendingWorkDataWrites.ts')
const { isDurableWriteBroken } = await import('./durableWriteGuard.ts')
const { getState, subscribe } = await import('../store/app-store.ts')
const { readJsonKey } = await import('../store/persist.ts')
const { commitWorkData } = await import('../store/commitHelpers.ts')

/** @typedef {import('../../domain/dayRecordTypes.ts').DayRecordLike} DayRecordLike */

/** @param {string} ownerKey */
function durableRaw(ownerKey) {
  return JSON.parse(localStorage.getItem(`reactPracticeDurablePendingWrites:${ownerKey}`) || '{}')
}

/** @param {string} ownerKey @returns {Record<string, DayRecordLike>} */
function readWorkData(ownerKey) {
  return readJsonKey('workData', ownerKey, /** @type {Record<string, DayRecordLike>} */ ({}))
}

/** @param {string} ownerKey @param {string} dateKey @returns {DayRecordLike|undefined} */
function committedRecord(ownerKey, dateKey) {
  const main = getState().workLogs[ownerKey]?.main
  return main ? (/** @type {Record<string, DayRecordLike>} */ (main))[dateKey] : undefined
}

test('등록 즉시 localStorage(durable)에 반영된다', () => {
  const ownerKey = 'pw-durable-basic'
  const patch = { isOff: false, fixedCount: 3, palletCount: 0, callDetails: [], fixedRouteCounts: {} }
  registerPendingDayWrite(ownerKey, '2026-08-01', patch)
  assert.deepEqual(durableRaw(ownerKey)['2026-08-01'], { isOff: false, fixedCount: 3, palletCount: 0, callDetails: [], fixedRouteCounts: {} })
  assert.equal(getPendingDayWrite(ownerKey, '2026-08-01')?.fixedCount, 3)
  clearPendingDayWrite(ownerKey, '2026-08-01', patch)
})

test('"모듈 재시작 후" 복구 — registerPendingDayWrite를 거치지 않고 localStorage에 직접 있던 값도 그대로 읽고 재시도한다', () => {
  const ownerKey = 'pw-hard-reload'
  const dateKey = '2026-08-02'
  localStorage.setItem(`reactPracticeDurablePendingWrites:${ownerKey}`, JSON.stringify({ [dateKey]: { isOff: false, fixedCount: 4, palletCount: 0, callDetails: [], fixedRouteCounts: {} } }))

  assert.equal(hasPendingDayWrites(), true)
  assert.equal(getPendingDayWrite(ownerKey, dateKey)?.fixedCount, 4)

  retryPendingDayWrites()
  assert.equal(getState().workLogs[ownerKey]?.main?.[dateKey]?.fixedCount, 4, '복구된 durable 항목이 store에 반영돼야 한다')
  assert.equal(readWorkData(ownerKey)[dateKey]?.fixedCount, 4)
  assert.deepEqual(durableRaw(ownerKey), {}, '성공했으니 durable 큐에서 지워져야 한다')
})

test('owner 전환 — 서로 다른 owner의 durable 큐는 섞이지 않는다', () => {
  const ownerA = 'pw-owner-a'
  const ownerB = 'pw-owner-b'
  registerPendingDayWrite(ownerA, '2026-08-03', { isOff: false, fixedCount: 1, palletCount: 0, callDetails: [], fixedRouteCounts: {} })
  registerPendingDayWrite(ownerB, '2026-08-04', { isOff: false, fixedCount: 2, palletCount: 0, callDetails: [], fixedRouteCounts: {} })

  assert.equal(pendingDayWriteCount() >= 2, true)
  retryPendingDayWrites()

  assert.equal(getState().workLogs[ownerA]?.main?.['2026-08-03']?.fixedCount, 1)
  assert.equal(getState().workLogs[ownerB]?.main?.['2026-08-04']?.fixedCount, 2)
  assert.deepEqual(durableRaw(ownerA), {}, 'A owner의 큐만 A의 커밋으로 지워져야 한다')
  assert.deepEqual(durableRaw(ownerB), {}, 'B owner의 큐도 B의 커밋으로 각자 지워져야 한다(서로 안 섞인다)')
})

test('재시도가 실패하면(store 커밋 자체가 실패) 큐에 그대로 남는다', () => {
  const ownerKey = 'pw-retry-fail'
  const dateKey = '2026-08-05'
  registerPendingDayWrite(ownerKey, dateKey, { isOff: false, fixedCount: 5, palletCount: 0, callDetails: [], fixedRouteCounts: {} })

  const proto = Object.getPrototypeOf(localStorage)
  const original = proto.setItem
  const spy = mock.method(proto, 'setItem', /** @this {Storage} @param {string} key @param {string} value */ function patchedSetItem(key, value) {
    if (key === `reactPracticeWorkData:${ownerKey}`) throw new Error('quota exceeded (simulated)')
    return original.call(this, key, value)
  })
  try {
    retryPendingDayWrites()
    assert.equal(getState().workLogs[ownerKey]?.main?.[dateKey], undefined, '실패했으니 store에 반영되면 안 된다')
    assert.equal(getPendingDayWrite(ownerKey, dateKey)?.fixedCount, 5, '실패했으니 큐에 그대로 남아야 한다')
  } finally {
    spy.mock.restore()
  }
  retryPendingDayWrites()
  assert.equal(getPendingDayWrite(ownerKey, dateKey), undefined)
})

test('onSettled 콜백은 durable 저장소가 아니라 메모리에만 있고, 재시도 성공 시 정확히 한 번 불린다', () => {
  const ownerKey = 'pw-onsettled'
  const dateKey = '2026-08-06'
  /** @type {Array<boolean>} */
  const calls = []
  registerPendingDayWrite(ownerKey, dateKey, { isOff: false, fixedCount: 6, palletCount: 0, callDetails: [], fixedRouteCounts: {} }, (ok) => calls.push(ok))

  assert.equal(JSON.stringify(durableRaw(ownerKey)).includes('function'), false, 'onSettled 콜백이 durable JSON에 직렬화되면 안 된다')

  retryPendingDayWrites()
  assert.deepEqual(calls, [true])
})

test('재감사 4차 FAIL 지적 1번 — 오래된 durable(A) 성공 후 최신 fallback(B) 실패 시 B가 사라지지 않는다', () => {
  const ownerKey = 'pw-coexist-a-b'
  const dateKey = '2026-08-09'

  registerPendingDayWrite(ownerKey, dateKey, { isOff: false, fixedCount: 1, palletCount: 0, callDetails: [], fixedRouteCounts: {} })
  assert.deepEqual(durableRaw(ownerKey)[dateKey], { isOff: false, fixedCount: 1, palletCount: 0, callDetails: [], fixedRouteCounts: {} })

  const proto = Object.getPrototypeOf(localStorage)
  const original = proto.setItem
  const durableKey = `reactPracticeDurablePendingWrites:${ownerKey}`
  const spy = mock.method(proto, 'setItem', /** @this {Storage} @param {string} key @param {string} value */ function patchedSetItem(key, value) {
    if (key === durableKey) throw new Error('quota exceeded (simulated, durable journal itself)')
    return original.call(this, key, value)
  })
  try {
    registerPendingDayWrite(ownerKey, dateKey, { isOff: false, fixedCount: 2, palletCount: 9, callDetails: [], fixedRouteCounts: {} })
  } finally {
    spy.mock.restore()
  }
  assert.deepEqual(durableRaw(ownerKey)[dateKey], { isOff: false, fixedCount: 1, palletCount: 0, callDetails: [], fixedRouteCounts: {} }, 'durable엔 여전히 A가 stale하게 남아 있어야 한다')
  assert.equal(getPendingDayWrite(ownerKey, dateKey)?.fixedCount, 2, '읽기는 이미 fallback(B, 최신)을 우선해야 한다')

  const workDataKey = `reactPracticeWorkData:${ownerKey}`
  let workDataWriteCount = 0
  const commitSpy = mock.method(proto, 'setItem', /** @this {Storage} @param {string} key @param {string} value */ function patchedSetItem(key, value) {
    if (key === workDataKey) workDataWriteCount += 1
    return original.call(this, key, value)
  })
  try {
    retryPendingDayWrites()
  } finally {
    commitSpy.mock.restore()
  }

  assert.equal(workDataWriteCount, 1, '같은 owner/date를 두 번 재시도하면 안 된다(동일 키 dedup)')
  assert.equal(getState().workLogs[ownerKey]?.main?.[dateKey]?.fixedCount, 2, '최종 커밋은 최신값 B(fixedCount:2)여야 한다')
  assert.equal(getState().workLogs[ownerKey]?.main?.[dateKey]?.palletCount, 9, 'B의 palletCount도 반영돼야 한다')
  assert.equal(getPendingDayWrite(ownerKey, dateKey), undefined, '성공했으니 큐(durable+fallback 양쪽)에서 지워져야 한다')
})

test('재감사 4차 FAIL 지적 1번 — durable(A)+fallback(B) 상태에서 유일한 커밋 시도가 실패하면 B가 큐에 그대로 남는다', () => {
  const ownerKey = 'pw-coexist-fail'
  const dateKey = '2026-08-10'
  registerPendingDayWrite(ownerKey, dateKey, { isOff: false, fixedCount: 1, palletCount: 0, callDetails: [], fixedRouteCounts: {} })

  const proto = Object.getPrototypeOf(localStorage)
  const original = proto.setItem
  const durableKey = `reactPracticeDurablePendingWrites:${ownerKey}`
  const workDataKey = `reactPracticeWorkData:${ownerKey}`
  let shouldFailDurable = true
  const spy = mock.method(proto, 'setItem', /** @this {Storage} @param {string} key @param {string} value */ function patchedSetItem(key, value) {
    if (shouldFailDurable && key === durableKey) throw new Error('quota exceeded (durable, simulated)')
    if (key === workDataKey) throw new Error('quota exceeded (workData, simulated)')
    return original.call(this, key, value)
  })
  try {
    registerPendingDayWrite(ownerKey, dateKey, { isOff: false, fixedCount: 2, palletCount: 9, callDetails: [], fixedRouteCounts: {} })
    shouldFailDurable = false
    retryPendingDayWrites()
  } finally {
    spy.mock.restore()
  }

  assert.equal(getState().workLogs[ownerKey]?.main?.[dateKey], undefined, '실패했으니 store는 그대로여야 한다')
  assert.equal(getPendingDayWrite(ownerKey, dateKey)?.fixedCount, 2, '실패한 effective patch(B)가 큐에 그대로 남아야 한다(사라지면 안 된다)')
  assert.equal(getPendingDayWrite(ownerKey, dateKey)?.palletCount, 9)

  retryPendingDayWrites()
  assert.equal(getState().workLogs[ownerKey]?.main?.[dateKey]?.fixedCount, 2)
})

test('durable 기록 자체가 실패하면 durableWriteGuard가 broken으로 바뀌고, 이번 세션 메모리 fallback으로는 여전히 재시도할 수 있다', () => {
  const ownerKey = 'pw-durable-broken'
  const dateKey = '2026-08-07'
  const proto = Object.getPrototypeOf(localStorage)
  const original = proto.setItem
  const spy = mock.method(proto, 'setItem', /** @this {Storage} @param {string} key @param {string} value */ function patchedSetItem(key, value) {
    if (key === `reactPracticeDurablePendingWrites:${ownerKey}`) throw new Error('quota exceeded (simulated, durable journal itself)')
    return original.call(this, key, value)
  })

  try {
    registerPendingDayWrite(ownerKey, dateKey, { isOff: false, fixedCount: 7, palletCount: 0, callDetails: [], fixedRouteCounts: {} })
    assert.equal(isDurableWriteBroken(), true, 'durable 기록이 실패했으니 가드가 broken이어야 한다')
    assert.equal(getPendingDayWrite(ownerKey, dateKey)?.fixedCount, 7, 'durable엔 못 썼어도 이번 세션 메모리 fallback으로는 읽혀야 한다')
  } finally {
    spy.mock.restore()
  }

  retryPendingDayWrites()
  assert.equal(getState().workLogs[ownerKey]?.main?.[dateKey]?.fixedCount, 7, '공간이 다시 생긴 뒤 재시도하면 fallback 항목도 정상 커밋돼야 한다')
  assert.equal(isDurableWriteBroken(), false, '이후 정상적인 durable 기록(다른 등록)이 성공하면 다시 healthy로 돌아와야 한다')
})

test('재감사 4차 FAIL 지적 2번 — owner A의 fallback이 남아 있으면 owner B의 durable 저장이 성공해도 broken은 true다', () => {
  const ownerA = 'pw-guard-owner-a'
  const ownerB = 'pw-guard-owner-b'
  const dateKey = '2026-08-11'
  const proto = Object.getPrototypeOf(localStorage)
  const original = proto.setItem
  const durableKeyA = `reactPracticeDurablePendingWrites:${ownerA}`

  const spy = mock.method(proto, 'setItem', /** @this {Storage} @param {string} key @param {string} value */ function patchedSetItem(key, value) {
    if (key === durableKeyA) throw new Error('quota exceeded (simulated, owner A durable journal)')
    return original.call(this, key, value)
  })
  try {
    registerPendingDayWrite(ownerA, dateKey, { isOff: false, fixedCount: 1, palletCount: 0, callDetails: [], fixedRouteCounts: {} })
  } finally {
    spy.mock.restore()
  }
  assert.equal(isDurableWriteBroken(), true, 'A의 durable 저장이 실패했으니 broken이어야 한다')

  registerPendingDayWrite(ownerB, dateKey, { isOff: false, fixedCount: 2, palletCount: 0, callDetails: [], fixedRouteCounts: {} })
  assert.deepEqual(durableRaw(ownerB)[dateKey], { isOff: false, fixedCount: 2, palletCount: 0, callDetails: [], fixedRouteCounts: {} }, 'B는 정상적으로 durable에 저장돼야 한다')

  assert.equal(isDurableWriteBroken(), true, 'B가 성공해도 A의 fallback이 아직 남아 있으니 broken은 계속 true여야 한다(예전엔 여기서 false로 잘못 돌아갔다)')

  retryPendingDayWrites()
  assert.equal(getPendingDayWrite(ownerA, dateKey), undefined, 'A도 결국 커밋돼 큐에서 지워져야 한다')
  assert.equal(isDurableWriteBroken(), false, '모든 owner의 fallback이 비었으니 이제야 healthy여야 한다')
})

test('재감사 4차 FAIL 지적 2번 — 한 항목 성공 처리 후에도 다른 fallback이 남으면 beforeunload 경고가 유지된다', async () => {
  const { guardBeforeUnload } = await import('./durableWriteGuard.ts')
  const ownerA = 'pw-guard-beforeunload-a'
  const ownerB = 'pw-guard-beforeunload-b'
  const dateKey = '2026-08-12'
  const proto = Object.getPrototypeOf(localStorage)
  const original = proto.setItem
  const durableKeyA = `reactPracticeDurablePendingWrites:${ownerA}`
  const durableKeyB = `reactPracticeDurablePendingWrites:${ownerB}`

  const spy = mock.method(proto, 'setItem', /** @this {Storage} @param {string} key @param {string} value */ function patchedSetItem(key, value) {
    if (key === durableKeyA || key === durableKeyB) throw new Error('quota exceeded (simulated)')
    return original.call(this, key, value)
  })
  const patchA = { isOff: false, fixedCount: 1, palletCount: 0, callDetails: [], fixedRouteCounts: {} }
  try {
    registerPendingDayWrite(ownerA, dateKey, patchA)
    registerPendingDayWrite(ownerB, dateKey, { isOff: false, fixedCount: 2, palletCount: 0, callDetails: [], fixedRouteCounts: {} })
  } finally {
    spy.mock.restore()
  }

  const eventA = { prevented: false, preventDefault() { this.prevented = true }, returnValue: false }
  guardBeforeUnload(eventA)
  assert.equal(eventA.prevented, true, '두 owner 다 fallback이 있으니 경고해야 한다')

  const { clearPendingDayWrite: clear } = await import('./pendingWorkDataWrites.ts')
  clear(ownerA, dateKey, patchA)

  const eventAfterA = { prevented: false, preventDefault() { this.prevented = true }, returnValue: false }
  guardBeforeUnload(eventAfterA)
  assert.equal(eventAfterA.prevented, true, 'A는 정리됐어도 B의 fallback이 남아 있으니 여전히 경고해야 한다')

  retryPendingDayWrites()
})

test('재감사 5차 FAIL 지적 1번 — durable cleanup 쓰기만 실패해도 최신 fallback(B)이 유실되지 않고, 복구 후 재시도해도 A로 되돌아가지 않는다', () => {
  const ownerKey = 'pw-cleanup-fail-residual'
  const dateKey = '2026-08-13'
  /** @type {Array<boolean>} */
  const calls = []

  registerPendingDayWrite(ownerKey, dateKey, { isOff: false, fixedCount: 1, palletCount: 0, callDetails: [], fixedRouteCounts: {} })
  assert.deepEqual(durableRaw(ownerKey)[dateKey], { isOff: false, fixedCount: 1, palletCount: 0, callDetails: [], fixedRouteCounts: {} })

  const proto = Object.getPrototypeOf(localStorage)
  const original = proto.setItem
  const durableKey = `reactPracticeDurablePendingWrites:${ownerKey}`
  let durableBlocked = true
  const spy = mock.method(proto, 'setItem', /** @this {Storage} @param {string} key @param {string} value */ function patchedSetItem(key, value) {
    if (durableBlocked && key === durableKey) throw new Error('quota exceeded (durable journal, simulated)')
    return original.call(this, key, value)
  })

  const patchB = { isOff: false, fixedCount: 2, palletCount: 9, callDetails: [], fixedRouteCounts: {} }
  try {
    registerPendingDayWrite(ownerKey, dateKey, patchB, (ok) => calls.push(ok))
    assert.deepEqual(durableRaw(ownerKey)[dateKey], { isOff: false, fixedCount: 1, palletCount: 0, callDetails: [], fixedRouteCounts: {} }, 'durable엔 여전히 stale A가 남아 있어야 한다')
    assert.equal(getPendingDayWrite(ownerKey, dateKey)?.fixedCount, 2, 'fallback의 B가 조회에서 우선해야 한다')

    retryPendingDayWrites()

    assert.equal(committedRecord(ownerKey, dateKey)?.fixedCount, 2, 'store는 B로 커밋돼야 한다')
    assert.equal(committedRecord(ownerKey, dateKey)?.palletCount, 9)
    assert.equal(readWorkData(ownerKey)[dateKey]?.fixedCount, 2, 'localStorage도 B여야 한다')

    assert.equal(getPendingDayWrite(ownerKey, dateKey)?.fixedCount, 2, 'cleanup이 실패했어도 pending은 여전히 B(최신)여야 한다 — A로 되돌아가면 안 된다')
    assert.equal(getPendingDayWrite(ownerKey, dateKey)?.palletCount, 9)

    assert.equal(pendingDayWriteCount(), 1, '같은 owner/date 키는 1건으로 계산돼야 한다')

    assert.equal(isDurableWriteBroken(), true, 'cleanup 실패로 fallback에 B가 residual로 남았으니 broken이어야 한다')

    assert.deepEqual(calls, [], 'cleanup이 실패한 동안엔 onSettled가 불리면 안 된다')

    durableBlocked = false
    retryPendingDayWrites()
  } finally {
    spy.mock.restore()
  }

  assert.equal(committedRecord(ownerKey, dateKey)?.fixedCount, 2, '복구 후 재시도해도 store는 계속 B여야 한다(A로 되돌아가면 안 된다)')
  assert.equal(committedRecord(ownerKey, dateKey)?.palletCount, 9)
  assert.deepEqual(durableRaw(ownerKey), {}, '이제는 durable에서도 stale A가 완전히 정리돼야 한다')

  assert.equal(pendingDayWriteCount(), 0, '완전히 정리됐으니 최종 pending count는 0이어야 한다')
  assert.equal(getPendingDayWrite(ownerKey, dateKey), undefined)

  assert.deepEqual(calls, [true], 'onSettled는 논리적 pending이 실제로 정리된 이 시점에 정확히 한 번만 불려야 한다')
})

test('재감사 6차 FAIL 지적 1번 — 시나리오 A: cleanup 시 durable getItem 자체가 실패해도 최신 fallback(B)이 유실되지 않고, 복구 후 재시도해도 A로 되돌아가지 않는다', () => {
  const ownerKey = 'pw-durable-getitem-fail'
  const dateKey = '2026-08-14'
  /** @type {Array<boolean>} */
  const calls = []

  registerPendingDayWrite(ownerKey, dateKey, { isOff: false, fixedCount: 1, palletCount: 0, callDetails: [], fixedRouteCounts: {} })

  const proto = Object.getPrototypeOf(localStorage)
  const originalSetItem = proto.setItem
  const originalGetItem = proto.getItem
  const durableKey = `reactPracticeDurablePendingWrites:${ownerKey}`
  let durableWriteBlocked = true
  const setSpy = mock.method(proto, 'setItem', /** @this {Storage} @param {string} key @param {string} value */ function patchedSetItem(key, value) {
    if (durableWriteBlocked && key === durableKey) throw new Error('quota exceeded (durable journal, simulated)')
    return originalSetItem.call(this, key, value)
  })

  const patchB = { isOff: false, fixedCount: 2, palletCount: 9, callDetails: [], fixedRouteCounts: {} }
  try {
    registerPendingDayWrite(ownerKey, dateKey, patchB, (ok) => calls.push(ok))
    assert.equal(getPendingDayWrite(ownerKey, dateKey)?.fixedCount, 2, 'fallback의 B가 조회에서 우선해야 한다')
  } finally {
    setSpy.mock.restore()
  }

  let durableReadBlocked = true
  let durableReadCallCount = 0
  const getSpy = mock.method(proto, 'getItem', /** @this {Storage} @param {string} key */ function patchedGetItem(key) {
    if (key === durableKey) {
      durableReadCallCount += 1
      if (durableReadBlocked && durableReadCallCount > 1) throw new Error('storage access denied (simulated, durable getItem)')
    }
    return originalGetItem.call(this, key)
  })

  try {
    retryPendingDayWrites()

    assert.equal(committedRecord(ownerKey, dateKey)?.fixedCount, 2, 'workData 커밋은 durable 읽기와 무관하게 성공해야 한다')
    assert.equal(readWorkData(ownerKey)[dateKey]?.fixedCount, 2)

    assert.equal(getPendingDayWrite(ownerKey, dateKey)?.fixedCount, 2, 'durable getItem이 실패해도 pending은 B여야 한다')
    assert.equal(pendingDayWriteCount(), 1, 'B가 fallback에 이미 반영돼 있으니 읽기 실패 owner를 이중으로 세면 안 된다')
    assert.equal(isDurableWriteBroken(), true, 'cleanup이 읽기 실패로 안 끝났으니 broken이어야 한다')
    assert.deepEqual(calls, [], 'cleanup이 안 끝났으니 onSettled가 불리면 안 된다')

    durableReadBlocked = false
    retryPendingDayWrites()
  } finally {
    getSpy.mock.restore()
  }

  assert.equal(committedRecord(ownerKey, dateKey)?.fixedCount, 2, '복구 후 재시도해도 store는 계속 B여야 한다')
  assert.equal(pendingDayWriteCount(), 0, '완전히 정리됐으니 최종 pending count는 0이어야 한다')
  assert.equal(getPendingDayWrite(ownerKey, dateKey), undefined)
  assert.deepEqual(calls, [true], 'onSettled는 cleanup이 실제로 성공한 이 시점에 정확히 한 번만 불려야 한다')
})

test('재감사 6차 FAIL 지적 1번 — 시나리오 B: 신규 날짜 등록 중 durable 읽기만 실패해도 기존 날짜(A/X) 원문이 파괴되지 않고, 복구 후 셋 다 유실 없이 처리된다', () => {
  const ownerKey = 'pw-durable-getitem-fail-existing'
  const dateA = '2026-08-15'
  const dateX = '2026-08-16'
  const dateB = '2026-08-17'

  registerPendingDayWrite(ownerKey, dateA, { isOff: false, fixedCount: 1, palletCount: 0, callDetails: [], fixedRouteCounts: {} })
  registerPendingDayWrite(ownerKey, dateX, { isOff: false, fixedCount: 5, palletCount: 0, callDetails: [], fixedRouteCounts: {} })
  const durableBefore = durableRaw(ownerKey)
  assert.deepEqual(Object.keys(durableBefore).sort(), [dateA, dateX])

  const proto = Object.getPrototypeOf(localStorage)
  const originalGetItem = proto.getItem
  const durableKey = `reactPracticeDurablePendingWrites:${ownerKey}`
  const getSpy = mock.method(proto, 'getItem', /** @this {Storage} @param {string} key */ function patchedGetItem(key) {
    if (key === durableKey) throw new Error('storage access denied (simulated, durable getItem)')
    return originalGetItem.call(this, key)
  })

  const patchB = { isOff: false, fixedCount: 9, palletCount: 0, callDetails: [], fixedRouteCounts: {} }
  try {
    registerPendingDayWrite(ownerKey, dateB, patchB)
    assert.equal(getPendingDayWrite(ownerKey, dateB)?.fixedCount, 9, 'B는 읽기 실패 중에도 fallback을 통해 즉시 조회 가능해야 한다')
  } finally {
    getSpy.mock.restore()
  }

  assert.deepEqual(durableRaw(ownerKey), durableBefore, '읽기 실패 중 등록이 기존 A/X durable 원문을 건드리면 안 된다')

  retryPendingDayWrites()

  assert.equal(committedRecord(ownerKey, dateA)?.fixedCount, 1, 'A가 유실되면 안 된다')
  assert.equal(committedRecord(ownerKey, dateX)?.fixedCount, 5, 'X가 유실되면 안 된다')
  assert.equal(committedRecord(ownerKey, dateB)?.fixedCount, 9, 'B도 반영돼야 한다')
  assert.equal(pendingDayWriteCount(), 0, '셋 다 정리됐으니 최종 count는 0이어야 한다')
})

test('재감사 6차 FAIL 지적 1번 — malformed durable JSON은 빈 큐로 간주되지 않고, 그 위에 파괴적으로 덮어쓰지 않는다', () => {
  const ownerKey = 'pw-durable-malformed-json'
  const dateKey = '2026-08-18'
  const durableKey = `reactPracticeDurablePendingWrites:${ownerKey}`
  const garbage = '{ this is not valid json'
  localStorage.setItem(durableKey, garbage)

  const patch = { isOff: false, fixedCount: 4, palletCount: 0, callDetails: [], fixedRouteCounts: {} }
  registerPendingDayWrite(ownerKey, dateKey, patch)

  assert.equal(localStorage.getItem(durableKey), garbage, 'malformed durable 원문을 파괴적으로 덮어쓰면 안 된다')
  assert.equal(getPendingDayWrite(ownerKey, dateKey)?.fixedCount, 4, '신규 patch는 fallback을 통해 조회 가능해야 한다')
  assert.equal(isDurableWriteBroken(), true, 'malformed durable은 읽기 실패로 취급돼 broken이어야 한다')

  localStorage.setItem(durableKey, '{}')
  retryPendingDayWrites()
  assert.equal(committedRecord(ownerKey, dateKey)?.fixedCount, 4, '복구 후 재시도로 patch가 정상 반영돼야 한다')
  assert.equal(pendingDayWriteCount(), 0)
})

/** @returns {number} */
function totalStubSupabaseCalls() {
  return Object.values(stubSupabaseCallCounts).reduce((sum, n) => sum + n, 0)
}

const MALFORMED_PATCH_CASES = /** @type {const} */ ([
  ['배열([])', []],
  ['null', null],
  ['문자열', 'oops'],
  ['숫자', 42],
  ['빈 객체({})', {}],
  ['fixedCount 타입 오류', { fixedCount: true }],
  ['callDetails가 배열이 아님', { fixedCount: 1, callDetails: 'nope' }],
  ['callDetails 내부 항목이 잘못된 객체', { fixedCount: 1, callDetails: [{ fare: {} }] }],
  ['fixedRouteCounts 값이 숫자가 아님', { fixedCount: 1, fixedRouteCounts: { r1: 'nope' } }],
  ['isOff만 있는 부분 patch(사용자 지정 재현)', { isOff: false }],
  ['fixedCount만 있는 부분 patch(사용자 지정 재현)', { fixedCount: 1 }],
  ['필수 필드 isOff 누락', { fixedCount: 1, palletCount: 0, callDetails: [], fixedRouteCounts: {} }],
  ['필수 필드 fixedCount 누락', { isOff: false, palletCount: 0, callDetails: [], fixedRouteCounts: {} }],
  ['필수 필드 palletCount 누락', { isOff: false, fixedCount: 1, callDetails: [], fixedRouteCounts: {} }],
  ['필수 필드 callDetails 누락', { isOff: false, fixedCount: 1, palletCount: 0, fixedRouteCounts: {} }],
  ['필수 필드 fixedRouteCounts 누락', { isOff: false, fixedCount: 1, palletCount: 0, callDetails: [] }],
])

MALFORMED_PATCH_CASES.forEach(([label, malformedValue], index) => {
  test(`재감사 7차 FAIL 지적 1번(P0) — durable patch 스키마 위반(${label})은 정상 pending으로 통과하지 않고 기존 일지를 보존한다`, () => {
    const ownerKey = `pw-schema-case-${index}`
    const dateKey = '2026-09-01'
    const durKey = `reactPracticeDurablePendingWrites:${ownerKey}`

    commitWorkData(ownerKey, { [dateKey]: { isOff: false, fixedCount: 5, palletCount: 0, callDetails: [], fixedRouteCounts: {} } })
    localStorage.setItem(durKey, JSON.stringify({ [dateKey]: malformedValue }))

    const storeBefore = JSON.stringify(getState().workLogs[ownerKey])
    const localBefore = JSON.stringify(readWorkData(ownerKey))
    const durableBefore = localStorage.getItem(durKey)
    const tombstoneBefore = JSON.stringify(readJsonKey('workDataDeletedDates', ownerKey, []))
    resetStubSupabaseCallCounts()
    let notifyCount = 0
    const unsubscribe = subscribe(() => { notifyCount += 1 })

    retryPendingDayWrites()
    unsubscribe()

    assert.equal(JSON.stringify(getState().workLogs[ownerKey]), storeBefore, `[${label}] Store의 기존 일지가 그대로 유지돼야 한다`)
    assert.equal(committedRecord(ownerKey, dateKey)?.fixedCount, 5, `[${label}] 기존 fixedCount:5가 지워지면 안 된다`)
    assert.equal(JSON.stringify(readWorkData(ownerKey)), localBefore, `[${label}] localStorage도 그대로 유지돼야 한다`)
    assert.equal(localStorage.getItem(durKey), durableBefore, `[${label}] durable 원문이 파괴적으로 덮어써지면 안 된다`)
    assert.equal(JSON.stringify(readJsonKey('workDataDeletedDates', ownerKey, [])), tombstoneBefore, `[${label}] tombstone이 변하면 안 된다`)
    assert.equal(notifyCount, 0, `[${label}] Store notify가 0회여야 한다`)
    assert.equal(totalStubSupabaseCalls(), 0, `[${label}] 원격 호출이 0회여야 한다`)
    assert.equal(isDurableWriteBroken(), true, `[${label}] 스키마 위반은 읽기 실패로 취급돼 broken이어야 한다`)
    assert.equal(hasPendingDayWrites(), true, `[${label}] "pending 없음"으로 거짓 판정하면 안 된다`)
  })
})

const VALID_PATCH_FOR_DATEKEY_TEST = { isOff: false, fixedCount: 9, palletCount: 0, callDetails: [], fixedRouteCounts: {} }

;['2026-99-99', '2026-02-30', '2026-02-29'].forEach((badDateKey, index) => {
  test(`재감사 8차 FAIL 지적 3번 — 존재하지 않는 달력 날짜(${badDateKey})는 dateKey로 거부되고 기존 일지를 보존한다`, () => {
    const ownerKey = `pw-datekey-reject-${index}`
    const dateKey = '2026-09-02'
    const durKey = `reactPracticeDurablePendingWrites:${ownerKey}`

    commitWorkData(ownerKey, { [dateKey]: { isOff: false, fixedCount: 5, palletCount: 0, callDetails: [], fixedRouteCounts: {} } })
    localStorage.setItem(durKey, JSON.stringify({ [dateKey]: VALID_PATCH_FOR_DATEKEY_TEST, [badDateKey]: VALID_PATCH_FOR_DATEKEY_TEST }))

    const storeBefore = JSON.stringify(getState().workLogs[ownerKey])
    const durableBefore = localStorage.getItem(durKey)
    const tombstoneBefore = JSON.stringify(readJsonKey('workDataDeletedDates', ownerKey, []))
    resetStubSupabaseCallCounts()
    let notifyCount = 0
    const unsubscribe = subscribe(() => { notifyCount += 1 })

    retryPendingDayWrites()
    unsubscribe()

    assert.equal(JSON.stringify(getState().workLogs[ownerKey]), storeBefore, `[${badDateKey}] Store가 그대로 유지돼야 한다`)
    assert.equal(committedRecord(ownerKey, dateKey)?.fixedCount, 5, `[${badDateKey}] 진짜 날짜의 기존 일지도 지워지면 안 된다`)
    assert.equal(localStorage.getItem(durKey), durableBefore, `[${badDateKey}] durable 원문이 그대로 보존돼야 한다`)
    assert.equal(JSON.stringify(readJsonKey('workDataDeletedDates', ownerKey, [])), tombstoneBefore, `[${badDateKey}] tombstone이 변하면 안 된다`)
    assert.equal(notifyCount, 0, `[${badDateKey}] notify가 0회여야 한다`)
    assert.equal(totalStubSupabaseCalls(), 0, `[${badDateKey}] 원격 호출이 0회여야 한다`)
    assert.equal(isDurableWriteBroken(), true, `[${badDateKey}] 잘못된 dateKey는 읽기 실패로 취급돼 broken이어야 한다`)
  })
})

;['2028-02-29', '2026-12-31'].forEach((goodDateKey, index) => {
  test(`재감사 8차 FAIL 지적 3번 — 실제 존재하는 달력 날짜(${goodDateKey})는 dateKey로 정상 허용된다`, () => {
    const ownerKey = `pw-datekey-accept-${index}`
    const durKey = `reactPracticeDurablePendingWrites:${ownerKey}`
    localStorage.setItem(durKey, JSON.stringify({ [goodDateKey]: VALID_PATCH_FOR_DATEKEY_TEST }))

    retryPendingDayWrites()

    assert.equal(committedRecord(ownerKey, goodDateKey)?.fixedCount, 9, `[${goodDateKey}] 정상 허용된 dateKey는 실제로 커밋돼야 한다`)
    assert.deepEqual(durableRaw(ownerKey), {}, `[${goodDateKey}] 정상 처리됐으니 durable 큐에서 지워져야 한다`)
  })
})

test('재감사 7차 FAIL 지적 2번 — localStorage.key() 열거 자체가 실패해도 retry는 상태를 안 바꾸고, guardBeforeUnload는 throw 없이 이동을 차단한다', async () => {
  const { guardBeforeUnload } = await import('./durableWriteGuard.ts')
  const ownerKey = 'pw-enum-key-fail'
  const dateKey = '2026-09-06'
  registerPendingDayWrite(ownerKey, dateKey, { isOff: false, fixedCount: 7, palletCount: 0, callDetails: [], fixedRouteCounts: {} })
  assert.deepEqual(durableRaw(ownerKey)[dateKey], { isOff: false, fixedCount: 7, palletCount: 0, callDetails: [], fixedRouteCounts: {} })

  const proto = Object.getPrototypeOf(localStorage)
  const keySpy = mock.method(proto, 'key', function patchedKey() {
    throw new Error('storage access denied (simulated, key() enumeration)')
  })

  try {
    assert.equal(hasUnsafePendingWrites(), true, '열거 실패는 보수적으로 안전하지 않다고 판단해야 한다')
    assert.equal(hasPendingDayWrites(), true, '열거 실패를 "pending 없음"으로 거짓 판정하면 안 된다')

    const storeBefore = JSON.stringify(getState().workLogs[ownerKey])
    const durableBefore = durableRaw(ownerKey)
    retryPendingDayWrites()
    assert.equal(JSON.stringify(getState().workLogs[ownerKey]), storeBefore, '열거 실패 시 retry는 store를 전혀 바꾸면 안 된다')
    assert.deepEqual(durableRaw(ownerKey), durableBefore, '열거 실패 시 retry는 durable 원문도 전혀 바꾸면 안 된다')
    assert.equal(pendingDayWriteCount() > 0, true, '열거 실패 중에도 count가 0으로 거짓 판정되면 안 된다')

    const event = { prevented: false, preventDefault() { this.prevented = true }, returnValue: false }
    assert.doesNotThrow(() => guardBeforeUnload(event), 'guardBeforeUnload가 열거 실패로 예외를 누출하면 안 된다')
    assert.equal(event.prevented, true, '열거 실패 상태에서도 이동을 차단해야 한다')
  } finally {
    keySpy.mock.restore()
  }

  retryPendingDayWrites()
  assert.equal(getPendingDayWrite(ownerKey, dateKey), undefined)
})

test('재감사 8차 FAIL 지적 2번 — 손상된 durable owner와 최신 fallback이 공존하면 retry가 그 owner를 통째로 건너뛰고, 명시적 복구 후에만 B가 정리된다', () => {
  const ownerKey = 'pw-corrupt-owner-with-fallback'
  const dateKey = '2026-09-07'
  const durKey = `reactPracticeDurablePendingWrites:${ownerKey}`
  /** @type {Array<boolean>} */
  const calls = []

  commitWorkData(ownerKey, { [dateKey]: { isOff: false, fixedCount: 5, palletCount: 0, callDetails: [], fixedRouteCounts: {} } })
  localStorage.setItem(durKey, JSON.stringify({ [dateKey]: [] }))
  const patchB = { isOff: false, fixedCount: 9, palletCount: 2, callDetails: [], fixedRouteCounts: {} }
  registerPendingDayWrite(ownerKey, dateKey, patchB, (ok) => calls.push(ok))
  assert.equal(getPendingDayWrite(ownerKey, dateKey)?.fixedCount, 9, 'fallback B가 조회에서 우선해야 한다')

  const storeBefore = JSON.stringify(getState().workLogs[ownerKey])
  const localBefore = JSON.stringify(readWorkData(ownerKey))
  const durableBefore = localStorage.getItem(durKey)
  const tombstoneBefore = JSON.stringify(readJsonKey('workDataDeletedDates', ownerKey, []))
  const countBefore = pendingDayWriteCount()
  resetStubSupabaseCallCounts()
  let notifyCount = 0
  const unsubscribe = subscribe(() => { notifyCount += 1 })

  retryPendingDayWrites()
  unsubscribe()

  assert.equal(JSON.stringify(getState().workLogs[ownerKey]), storeBefore, 'Store의 기존 fixedCount:5가 그대로 유지돼야 한다')
  assert.equal(committedRecord(ownerKey, dateKey)?.fixedCount, 5, '기존 fixedCount:5가 지워지거나 B로 덮이면 안 된다')
  assert.equal(JSON.stringify(readWorkData(ownerKey)), localBefore, 'localStorage도 그대로 유지돼야 한다')
  assert.equal(localStorage.getItem(durKey), durableBefore, 'durable 원문이 바이트 단위로 그대로 유지돼야 한다')
  assert.equal(getPendingDayWrite(ownerKey, dateKey)?.fixedCount, 9, 'fallback B는 조회에서 여전히 그대로 남아 있어야 한다')
  assert.equal(JSON.stringify(readJsonKey('workDataDeletedDates', ownerKey, [])), tombstoneBefore, 'tombstone이 변하면 안 된다')
  assert.equal(notifyCount, 0, 'Store notify가 0회여야 한다')
  assert.equal(totalStubSupabaseCalls(), 0, '원격 호출이 0회여야 한다')
  assert.equal(isDurableWriteBroken(), true, '손상된 owner가 있으니 broken이어야 한다')
  assert.equal(pendingDayWriteCount(), countBefore, 'pending 논리 키 count는 retry 전후로 그대로여야 한다')
  assert.deepEqual(calls, [], '커밋 자체가 시도되지 않았으니 onSettled가 불리면 안 된다')

  localStorage.setItem(durKey, '{}')
  retryPendingDayWrites()

  assert.equal(committedRecord(ownerKey, dateKey)?.fixedCount, 9, '복구 후 재시도로 B가 정확히 한 번 커밋돼야 한다')
  assert.equal(committedRecord(ownerKey, dateKey)?.palletCount, 2)
  assert.equal(pendingDayWriteCount(), countBefore - 1, '이 owner가 정리되며 전역 count가 정확히 1 줄어야 한다')
  assert.equal(getPendingDayWrite(ownerKey, dateKey), undefined)
  assert.deepEqual(calls, [true], 'onSettled는 복구 후 정리가 실제로 끝난 이 시점에 정확히 한 번만 불려야 한다')
})

test('재감사 9차 FAIL 지적 3번 — registerPendingDayWrite가 잘못된 dateKey/patch를 받으면 기존 상태를 전혀 건드리지 않고 false를 돌려준다', () => {
  const ownerKey = 'pw-register-input-validation'
  const dateKeyGood = '2026-09-15'
  /** @type {Array<boolean>} */
  const calls = []
  const goodPatch = { isOff: false, fixedCount: 3, palletCount: 0, callDetails: [], fixedRouteCounts: {} }
  const registeredOk = registerPendingDayWrite(ownerKey, dateKeyGood, goodPatch, (ok) => calls.push(ok))
  assert.equal(registeredOk, true, '정상 입력은 true를 돌려줘야 한다')
  const durableBefore = durableRaw(ownerKey)

  const r1 = registerPendingDayWrite(ownerKey, '2026-02-30', goodPatch, () => { throw new Error('불려지면 안 됨') })
  assert.equal(r1, false, '잘못된 dateKey는 false를 돌려줘야 한다')
  assert.deepEqual(durableRaw(ownerKey), durableBefore, '잘못된 dateKey는 기존 durable 원문을 전혀 건드리면 안 된다')
  assert.equal(getPendingDayWrite(ownerKey, dateKeyGood)?.fixedCount, 3, '기존 정상 항목이 그대로 남아 있어야 한다')

  const incompletePatch = /** @type {import('./pendingWorkDataWritesTypes.ts').EffectivePatch} */ ({ isOff: false })
  const r2 = registerPendingDayWrite(ownerKey, '2026-09-16', incompletePatch, () => { throw new Error('불려지면 안 됨') })
  assert.equal(r2, false, '잘못된 patch는 false를 돌려줘야 한다')
  assert.deepEqual(durableRaw(ownerKey), durableBefore, '잘못된 patch도 기존 durable 원문을 전혀 건드리면 안 된다')
  assert.equal(getPendingDayWrite(ownerKey, '2026-09-16'), undefined, '거부된 항목은 조회되면 안 된다')

  assert.equal(getState().workLogs[ownerKey], undefined, 'registerPendingDayWrite는 Store를 건드리면 안 된다')

  retryPendingDayWrites()
  assert.deepEqual(calls, [true], '기존 정상 항목의 callback만 정확히 한 번 불려야 한다(거부된 두 등록의 throw하는 콜백은 절대 안 불림)')
})

test('재감사 10차 FAIL 지적 1번(P0) — id 없는 레거시 payment와 통화 문자열 amount를 가진 콜상세도 정상적으로 커밋된다', () => {
  const ownerKey = 'pw-legacy-payment-accept'
  const dateKey = '2026-09-20'
  const patch = {
    isOff: false,
    fixedCount: 2,
    palletCount: 0,
    callDetails: [{
      id: 'trp_legacy_1',
      fare: '10,000',
      payments: [{ amount: '1,000' }, { amount: '1,000원' }, { amount: 1000, note: '' }],
    }],
    fixedRouteCounts: {},
  }
  const registered = registerPendingDayWrite(ownerKey, dateKey, patch)
  assert.equal(registered, true, 'id 없는 레거시 payment/통화 문자열 amount도 정상 접수돼야 한다')
  assert.equal(getPendingDayWrite(ownerKey, dateKey)?.fixedCount, 2, '접수 직후 조회에서도 그대로 보여야 한다')

  retryPendingDayWrites()

  assert.equal(committedRecord(ownerKey, dateKey)?.fixedCount, 2, '레거시 payment 모양이 있어도 정상 커밋돼야 한다')
  assert.equal(getPendingDayWrite(ownerKey, dateKey), undefined, '정상 처리됐으니 이 owner/date는 큐에서 지워져야 한다')
})

test('재감사 10차 FAIL 지적 1번 — 임의 문자열·음수·NaN·Infinity·중첩 객체 amount는 거부하고 기존 정상 항목은 보존한다', () => {
  const ownerKey = 'pw-legacy-payment-reject'
  const dateKeyGood = '2026-09-21'
  const dateKeyBad = '2026-09-22'
  const goodPatch = {
    isOff: false,
    fixedCount: 3,
    palletCount: 0,
    callDetails: [{ id: 'trp_ok', fare: '10,000', payments: [{ amount: '1,000' }, { amount: 1000 }] }],
    fixedRouteCounts: {},
  }
  assert.equal(registerPendingDayWrite(ownerKey, dateKeyGood, goodPatch, (ok) => { if (!ok) throw new Error('정상 항목 callback이 실패로 불리면 안 됨') }), true)
  const durableBefore = localStorage.getItem(`reactPracticeDurablePendingWrites:${ownerKey}`)

  /** @param {string|number|{ nested: number }} amount */
  function patchWithAmount(amount) {
    return {
      isOff: false,
      fixedCount: 9,
      palletCount: 0,
      callDetails: [{ id: 'trp_bad', fare: '10,000', payments: [{ amount }] }],
      fixedRouteCounts: {},
    }
  }
  const rejected = [
    registerPendingDayWrite(ownerKey, dateKeyBad, /** @type {import('./pendingWorkDataWritesTypes.ts').EffectivePatch} */ (patchWithAmount('oops'))),
    registerPendingDayWrite(ownerKey, dateKeyBad, /** @type {import('./pendingWorkDataWritesTypes.ts').EffectivePatch} */ (patchWithAmount(','))),
    registerPendingDayWrite(ownerKey, dateKeyBad, /** @type {import('./pendingWorkDataWritesTypes.ts').EffectivePatch} */ (patchWithAmount('.'))),
    registerPendingDayWrite(ownerKey, dateKeyBad, /** @type {import('./pendingWorkDataWritesTypes.ts').EffectivePatch} */ (patchWithAmount('원'))),
    registerPendingDayWrite(ownerKey, dateKeyBad, /** @type {import('./pendingWorkDataWritesTypes.ts').EffectivePatch} */ (patchWithAmount(-1))),
    registerPendingDayWrite(ownerKey, dateKeyBad, /** @type {import('./pendingWorkDataWritesTypes.ts').EffectivePatch} */ (patchWithAmount(Number.NaN))),
    registerPendingDayWrite(ownerKey, dateKeyBad, /** @type {import('./pendingWorkDataWritesTypes.ts').EffectivePatch} */ (patchWithAmount(Number.POSITIVE_INFINITY))),
    registerPendingDayWrite(ownerKey, dateKeyBad, /** @type {import('./pendingWorkDataWritesTypes.ts').EffectivePatch} */ (patchWithAmount('1,00'))),
    registerPendingDayWrite(ownerKey, dateKeyBad, /** @type {import('./pendingWorkDataWritesTypes.ts').EffectivePatch} */ (patchWithAmount('1,,000'))),
    registerPendingDayWrite(ownerKey, dateKeyBad, /** @type {import('./pendingWorkDataWritesTypes.ts').EffectivePatch} */ (patchWithAmount('1,000.50'))),
    registerPendingDayWrite(ownerKey, dateKeyBad, /** @type {import('./pendingWorkDataWritesTypes.ts').EffectivePatch} */ (patchWithAmount({ nested: 1 }))),
  ]
  assert.equal(rejected.every((ok) => ok === false), true, 'oops·기호만·잘못된 쉼표·소수·음수·NaN·Infinity·중첩 객체 amount는 전부 거부돼야 한다')
  assert.equal(localStorage.getItem(`reactPracticeDurablePendingWrites:${ownerKey}`), durableBefore, '거부된 등록은 기존 durable 원문을 건드리면 안 된다')
  assert.equal(getPendingDayWrite(ownerKey, dateKeyGood)?.fixedCount, 3, '기존 정상 항목이 그대로 남아 있어야 한다')
  assert.equal(getPendingDayWrite(ownerKey, dateKeyBad), undefined, '거부된 날짜는 큐에 없어야 한다')

  const dateKeyEmpty = '2026-09-23'
  assert.equal(registerPendingDayWrite(ownerKey, dateKeyEmpty, patchWithAmount('')), true, '빈 문자열 amount는 미입력(0)으로 허용돼야 한다')
  assert.equal(getPendingDayWrite(ownerKey, dateKeyEmpty)?.fixedCount, 9, '빈 amount 접수는 큐에 남아야 한다')

  retryPendingDayWrites()
  assert.equal(getPendingDayWrite(ownerKey, dateKeyGood), undefined, '정상 항목은 정리돼야 한다')
  assert.equal(getPendingDayWrite(ownerKey, dateKeyEmpty), undefined, '빈 amount 항목도 정상 커밋 후 정리돼야 한다')
})
