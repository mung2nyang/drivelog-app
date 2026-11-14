import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { dayLogReducer, dayOffPatch, initDayLogState } from './day-log-reducer.ts'

describe('initDayLogState — store record을 로컬 draft로 복제', () => {
  test('record가 없으면(신규 날짜) 빈 draft', () => {
    const state = initDayLogState(undefined)
    assert.deepEqual(state.draft, { isOff: false, fixedCount: 0, palletCount: 0, callDetails: [], fixedRouteCounts: {} })
    assert.equal(state.editingCallId, null)
    assert.equal(state.callFormOpen, false)
  })

  test('record 값을 그대로 옮기되 배열/객체는 새 참조로 복제한다(참조 공유 버그 방지)', () => {
    const callDetails = [{ id: 'a', fare: '1000' }]
    const fixedRouteCounts = { r1: 2 }
    const record = { isOff: false, fixedCount: 3, palletCount: 1, callDetails, fixedRouteCounts }
    const state = initDayLogState(record)
    assert.deepEqual(state.draft.callDetails, callDetails)
    assert.notEqual(state.draft.callDetails, callDetails, 'callDetails는 새 배열이어야 한다')
    assert.deepEqual(state.draft.fixedRouteCounts, fixedRouteCounts)
    assert.notEqual(state.draft.fixedRouteCounts, fixedRouteCounts, 'fixedRouteCounts는 새 객체여야 한다')
  })

  test('재감사(FAIL 지적 3번) — initDayLogState는 더 이상 id를 스스로 만들지 않는다', () => {
    const state = initDayLogState({ callDetails: [{ fare: '1000' }] })
    assert.equal(state.draft.callDetails[0].id, undefined, 'initDayLogState가 스스로 id를 만들면 안 된다')
  })

  test('휴무면 fixedCount/palletCount를 0으로 정규화한다', () => {
    const state = initDayLogState({ isOff: true, fixedCount: 5, palletCount: 2 })
    assert.equal(state.draft.fixedCount, 0)
    assert.equal(state.draft.palletCount, 0)
  })

  test('휴무 기록을 열면 노선 칩 횟수도 비운다', () => {
    const state = initDayLogState({ isOff: true, fixedCount: 0, fixedRouteCounts: { r1: 2 } })
    assert.deepEqual(state.draft.fixedRouteCounts, {})
  })
})

describe('dayLogReducer — patchDraft/openCallForm/closeCallForm', () => {
  test('patchDraft는 draft만 얕게 병합하고 나머지 state는 그대로다', () => {
    const state = initDayLogState(undefined)
    const next = dayLogReducer(state, { type: 'patchDraft', patch: { fixedCount: 4 } })
    assert.equal(next.draft.fixedCount, 4)
    assert.equal(next.draft.isOff, false)
    assert.equal(next.editingCallId, null)
    assert.equal(next.callFormOpen, false)
    assert.notEqual(next, state)
    assert.notEqual(next.draft, state.draft)
  })

  test('openCallForm(id)은 콜상세 폼을 열고 editingCallId를 그 id로 둔다', () => {
    const state = initDayLogState(undefined)
    const next = dayLogReducer(state, { type: 'openCallForm', id: 'call-1' })
    assert.equal(next.callFormOpen, true)
    assert.equal(next.editingCallId, 'call-1')
  })

  test('openCallForm(null)은 신규 입력(수정 아님)으로 연다', () => {
    const state = initDayLogState(undefined)
    const next = dayLogReducer(state, { type: 'openCallForm', id: null })
    assert.equal(next.callFormOpen, true)
    assert.equal(next.editingCallId, null)
  })

  test('closeCallForm은 폼을 닫고 editingCallId를 비운다 — draft는 손대지 않는다', () => {
    let state = initDayLogState(undefined)
    state = dayLogReducer(state, { type: 'patchDraft', patch: { fixedCount: 7 } })
    state = dayLogReducer(state, { type: 'openCallForm', id: 'x' })
    const next = dayLogReducer(state, { type: 'closeCallForm' })
    assert.equal(next.callFormOpen, false)
    assert.equal(next.editingCallId, null)
    assert.equal(next.draft.fixedCount, 7)
  })

  test('알 수 없는 action은 state를 그대로(같은 참조) 돌려준다', () => {
    const state = initDayLogState(undefined)
    const next = dayLogReducer(state, { type: 'unknown' })
    assert.equal(next, state)
  })
})

describe('dayOffPatch — 휴무 단추·운비서 휴무가 같이 쓰는 값', () => {
  test('휴무를 켜면 운행 횟수·노선 칩 횟수·파렛트 0', () => {
    assert.deepEqual(dayOffPatch(true), { isOff: true, fixedCount: 0, palletCount: 0, fixedRouteCounts: {} })
  })

  test('휴무를 끄면 휴무만 끈다', () => {
    assert.deepEqual(dayOffPatch(false), { isOff: false })
  })
})
