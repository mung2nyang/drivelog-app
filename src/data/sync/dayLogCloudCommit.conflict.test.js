import '../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { describe, mock, test } from 'node:test'
import { createFakeSupabase } from '../../testSupport/fakeSupabaseClient.ts'

const { fakeSupabase, handlers, resetHandlers, countOf, callsOf, emptyOkHandlers } = createFakeSupabase()
mock.module('../cloud/supabaseClient.ts', { namedExports: { supabase: fakeSupabase } })

const { commitMainDayLogToCloud, commitMainDayLogMapToCloud } = await import('./dayLogCloudCommit.ts')
const { beginSessionEpoch, endCloudSession } = await import('../cloud/cloudSession.ts')
const { setHydration, getState } = await import('../store/app-store.ts')
const { commitCars, commitWorkData } = await import('../store/commitHelpers.ts')
const { dayLogVersion, setDayLogVersion } = await import('./dayLogVersions.ts')

const DK = '2026-10-10'
const CAR = 710
const CONFLICT = { message: '다른 기기에서 먼저 고친 일지입니다.', code: 'DL409' }
const RELOADED = '다른 기기에서 먼저 고친 일지라 저장하지 못했습니다. 최신 내용을 불러왔으니 확인한 뒤 다시 입력해 주세요.'
const STALE = '다른 기기에서 먼저 고친 일지라 저장하지 못했습니다. 앱을 다시 켜서 최신 내용을 확인해 주세요.'

/** @param {string} ownerKey */
function beginLoggedIn(ownerKey) {
  resetHandlers()
  Object.assign(handlers, emptyOkHandlers())
  beginSessionEpoch('u-cf', ownerKey)
  setHydration({ status: 'ready', userId: 'u-cf', ownerKey })
  commitCars(ownerKey, [{ id: 'car-main', type: 'main', number: '12가3456', supabaseId: CAR }])
  commitWorkData(ownerKey, { [DK]: { fixedCount: 1, callDetails: [{ id: 'mine', fare: '1000' }] } })
  setDayLogVersion(CAR, DK, null)
}

/** @param {string} fn */
function sentBases(fn) {
  return callsOf('rpc', fn).map((call) => {
    const args = call.args[0]
    return args && typeof args === 'object' && !Array.isArray(args) ? args.p_expected_updated_at : undefined
  })
}

const PREV = { [DK]: { fixedCount: 1, callDetails: [{ id: 'mine', fare: '1000' }] } }
const NEXT = { [DK]: { fixedCount: 2, callDetails: [{ id: 'mine', fare: '1000' }] } }

describe('저장·지우기는 알던 고친 시각을 보내고 돌려받은 시각으로 바꾼다', () => {
  test('V-1 저장: 알던 시각을 보내고, 성공하면 새 시각을 기억', async () => {
    beginLoggedIn('own-v1')
    setDayLogVersion(CAR, DK, 'v1')
    handlers.rpc = { save_day_log: () => ({ data: 'v2', error: null }) }
    const first = await commitMainDayLogToCloud({ ownerKey: 'own-v1', logId: 'main', dateKey: DK, previousData: PREV, nextData: NEXT })
    const second = await commitMainDayLogToCloud({ ownerKey: 'own-v1', logId: 'main', dateKey: DK, previousData: NEXT, nextData: PREV })
    assert.deepEqual([first, second].map((r) => r.cloud && r.ok), [true, true])
    assert.deepEqual(sentBases('save_day_log'), ['v1', 'v2'])
    endCloudSession()
  })

  test('V-2 지우기: 알던 시각을 보내고, 빈 줄로 남으면 새 시각, 줄이 지워지면 모름', async () => {
    beginLoggedIn('own-v2')
    setDayLogVersion(CAR, DK, 'v1')
    handlers.rpc = { remove_day_log: () => ({ data: 'v-blank', error: null }) }
    await commitMainDayLogToCloud({ ownerKey: 'own-v2', logId: 'main', dateKey: DK, previousData: PREV, nextData: {} })
    assert.equal(dayLogVersion(CAR, DK), 'v-blank')
    handlers.rpc = { remove_day_log: () => ({ data: null, error: null }) }
    await commitMainDayLogToCloud({ ownerKey: 'own-v2', logId: 'main', dateKey: DK, previousData: PREV, nextData: {} })
    assert.deepEqual(sentBases('remove_day_log'), ['v1', 'v-blank'])
    assert.equal(dayLogVersion(CAR, DK), null)
    endCloudSession()
  })

  test('V-3 거절로 보는 것은 오류 코드 DL409뿐, 다른 오류는 지금처럼 일반 실패', async () => {
    beginLoggedIn('own-v3')
    handlers.rpc = { save_day_log: () => ({ data: null, error: { message: '다른 기기에서 먼저 고친 일지입니다.', code: 'P0001' } }) }
    const r = await commitMainDayLogToCloud({ ownerKey: 'own-v3', logId: 'main', dateKey: DK, previousData: PREV, nextData: NEXT })
    assert.deepEqual(r, { cloud: true, ok: false, toast: '저장에 실패했습니다. 네트워크 상태를 확인해 주세요.' })
    assert.equal(countOf('daily_logs', 'select'), 0)
    endCloudSession()
  })
})

describe('거절되면 덮어쓰지 않고 그날만 서버에서 다시 읽는다', () => {
  test('R-1 다시 읽기 성공: Store·시각이 서버 최신, 안내 문구, 결과에 거절 표시', async () => {
    beginLoggedIn('own-r1')
    setDayLogVersion(CAR, DK, 'v-stale')
    handlers.rpc = { save_day_log: () => ({ data: null, error: CONFLICT }) }
    handlers.daily_logs = { select: () => ({ data: [{ work_date: DK, is_off: false, fixed_count: 3, raw: { fixedCount: 3 }, updated_at: 'v-server' }], error: null }) }
    handlers.transport_details = { select: () => ({ data: [{ work_date: DK, raw: { id: 'other', fare: '9000' } }, { work_date: DK, raw: { id: 'mine', fare: '1000' } }], error: null }) }
    const r = await commitMainDayLogToCloud({ ownerKey: 'own-r1', logId: 'main', dateKey: DK, previousData: PREV, nextData: NEXT })
    assert.deepEqual(r, { cloud: true, ok: false, toast: RELOADED, conflict: true, reloaded: true })
    const day = getState().workLogs['own-r1']?.main?.[DK]
    assert.equal(day?.fixedCount, 3)
    assert.deepEqual(day?.callDetails?.map((call) => call.id), ['other', 'mine'], '다른 기기 콜이 보임')
    assert.equal(dayLogVersion(CAR, DK), 'v-server')
    const ops = callsOf('daily_logs', 'select')[0]?.ops || []
    assert.deepEqual(ops.filter((op) => op[0] === 'eq'), [['eq', 'vehicle_id', CAR], ['eq', 'work_date', DK]], '그날 하루만 읽음')
    endCloudSession()
  })

  test('R-2 서버에서 그날이 지워졌으면 Store에서도 빠지고 시각은 모름', async () => {
    beginLoggedIn('own-r2')
    setDayLogVersion(CAR, DK, 'v-stale')
    handlers.rpc = { save_day_log: () => ({ data: null, error: CONFLICT }) }
    handlers.daily_logs = { select: () => ({ data: [], error: null }) }
    handlers.transport_details = { select: () => ({ data: [], error: null }) }
    const r = await commitMainDayLogToCloud({ ownerKey: 'own-r2', logId: 'main', dateKey: DK, previousData: PREV, nextData: NEXT })
    assert.equal(r.cloud && r.reloaded, true)
    assert.equal(getState().workLogs['own-r2']?.main?.[DK], undefined)
    assert.equal(dayLogVersion(CAR, DK), null)
    endCloudSession()
  })

  test('R-3 다시 읽기 실패: Store·시각 그대로, "앱을 다시 켜서" 안내', async () => {
    beginLoggedIn('own-r3')
    setDayLogVersion(CAR, DK, 'v-stale')
    handlers.rpc = { save_day_log: () => ({ data: null, error: CONFLICT }) }
    handlers.daily_logs = { select: () => ({ data: null, error: { message: 'down' } }) }
    handlers.transport_details = { select: () => ({ data: [], error: null }) }
    const r = await commitMainDayLogToCloud({ ownerKey: 'own-r3', logId: 'main', dateKey: DK, previousData: PREV, nextData: NEXT })
    assert.deepEqual(r, { cloud: true, ok: false, toast: STALE, conflict: true, reloaded: false })
    assert.equal(getState().workLogs['own-r3']?.main?.[DK]?.fixedCount, 1)
    assert.equal(dayLogVersion(CAR, DK), 'v-stale')
    endCloudSession()
  })

  test('R-4 여러 날 저장: 시각은 보내지만 거절된 날은 실패 건수로만, 다시 읽지 않음', async () => {
    beginLoggedIn('own-r4')
    setDayLogVersion(CAR, DK, 'v-stale')
    handlers.rpc = { save_day_log: () => ({ data: null, error: CONFLICT }) }
    const r = await commitMainDayLogMapToCloud({ ownerKey: 'own-r4', logId: 'main', dateKeys: [DK], previousData: PREV, nextData: NEXT })
    assert.equal(r.cloud && r.ok, false)
    assert.deepEqual(r.cloud && r.failedDateKeys, [DK])
    assert.deepEqual(sentBases('save_day_log'), ['v-stale'])
    assert.equal(countOf('daily_logs', 'select'), 0)
    endCloudSession()
  })
})
