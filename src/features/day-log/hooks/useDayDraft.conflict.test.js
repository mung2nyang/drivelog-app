import '../../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { createFakeSupabase } from '../../../testSupport/fakeSupabaseClient.ts'

const { fakeSupabase, handlers, resetHandlers, emptyOkHandlers, countOf, callsOf } = createFakeSupabase()
mock.module('../../../data/cloud/supabaseClient.ts', { namedExports: { supabase: fakeSupabase } })

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { withToast } = await import('../../../testSupport/withToast.ts')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { useDayDraft } = await import('./useDayDraft.ts')
const { beginSessionEpoch, endCloudSession } = await import('../../../data/cloud/cloudSession.ts')
const { setHydration } = await import('../../../data/store/app-store.ts')
const { commitCars, commitWorkData } = await import('../../../data/store/commitHelpers.ts')
const { readOwnerWorkData } = await import('../../../data/store/ownerDataHooks.ts')
const { addFailedDayLogDate, getFailedDayLogBase, getFailedDayLogPatch, listFailedDayLogDates } = await import('../../../data/sync/failedDayLogDates.ts')
const { dayLogVersion, setDayLogVersion } = await import('../../../data/sync/dayLogVersions.ts')

const DK = '2026-10-21'
const CAR = 800
const SERVER_AT = '2026-11-17T01:02:03.456789+00:00'
const CONFLICT_HEAD = '10월 21일 운행일지는 다른 기기에서 먼저 고쳐 저장하지 못했습니다. '

/** @param {number} ms */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** @param {string} userId @param {string} ownerKey */
function beginLoggedIn(userId, ownerKey) {
  resetHandlers()
  Object.assign(handlers, emptyOkHandlers())
  beginSessionEpoch(userId, ownerKey)
  setHydration({ status: 'ready', userId, ownerKey })
  commitCars(ownerKey, [{ id: 'car-main', type: 'main', number: '12가3456', supabaseId: CAR }])
  commitWorkData(ownerKey, {})
  setDayLogVersion(CAR, DK, null)
}

function serverDayIs7() {
  handlers.daily_logs = { select: () => ({ data: [{ work_date: DK, is_off: false, fixed_count: 7, raw: { fixedCount: 7 }, updated_at: SERVER_AT }], error: null }) }
  handlers.transport_details = { select: () => ({ data: [], error: null }) }
}

function conflictOnSave() {
  handlers.rpc = { save_day_log: () => ({ data: null, error: { message: '다른 기기에서 먼저 고친 일지입니다.', code: 'DL409' } }) }
}

function sentBases() {
  return callsOf('rpc', 'save_day_log').map((call) => {
    const args = call.args[0]
    return args && typeof args === 'object' && !Array.isArray(args) ? args.p_expected_updated_at : undefined
  })
}

/** @param {string} ownerKey */
async function mount(ownerKey) {
  /** @type {{ current: ReturnType<typeof useDayDraft>|null }} */
  const latest = { current: null }
  /** @type {Array<string>} */
  const toasts = []
  function Harness() {
    latest.current = useDayDraft(ownerKey, DK)
    return null
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => { root.render(withToast(React.createElement(Harness), (/** @type {string} */ message) => { toasts.push(message) })) })
  return {
    latest,
    toasts,
    /** @param {number} fixedCount */
    async edit(fixedCount) {
      await act(async () => { latest.current?.dispatch({ type: 'patchDraft', patch: { fixedCount } }) })
    },
    async settle() {
      await act(async () => { await wait(700) })
    },
    async unmount() {
      await act(async () => { root.unmount() })
      container.remove()
    },
  }
}

test('C-1 거절: 그날을 서버에서 다시 읽고, 화면은 더 저장하지 않고, 실패 목록엔 날짜만', async () => {
  beginLoggedIn('u-c1', 'own-c1')
  conflictOnSave()
  serverDayIs7()
  const view = await mount('own-c1')
  try {
    await view.edit(1)
    await view.settle()
    assert.deepEqual(view.toasts, [CONFLICT_HEAD + '일지를 닫았다가 다시 열면 최신 내용이 보입니다.'])
    assert.equal(view.latest.current?.autoSaveStatus, 'failed')
    assert.equal(readOwnerWorkData('own-c1')[DK]?.fixedCount, 7, 'Store는 서버 최신 내용')
    assert.equal(dayLogVersion(CAR, DK), SERVER_AT, '시각도 최신')
    assert.deepEqual(listFailedDayLogDates('own-c1'), [{ logId: 'main', dateKey: DK }])
    assert.equal(getFailedDayLogPatch('own-c1', 'main', DK), undefined, '보관 내용 없음')

    await view.edit(2)
    await view.settle()
    assert.equal(countOf('rpc', 'save_day_log'), 1, '거절 뒤 고쳐도 저장 안 함')
    assert.equal(view.latest.current?.autoSaveStatus, 'failed')
    await view.unmount()
    assert.equal(countOf('rpc', 'save_day_log'), 1, '닫아도 저장 안 함')

    handlers.rpc = { save_day_log: () => ({ data: '2026-11-17T09:00:00+00:00', error: null }) }
    const again = await mount('own-c1')
    assert.equal(again.latest.current?.draft.fixedCount, 7, '다시 열면 최신 내용')
    assert.deepEqual(listFailedDayLogDates('own-c1'), [], '다시 열면 알림 빠짐')
    await again.edit(8)
    await again.settle()
    assert.deepEqual(sentBases(), [null, SERVER_AT], '다시 연 뒤에는 최신 시각으로 저장')
    assert.equal(again.latest.current?.autoSaveStatus, 'saved')
    assert.equal(dayLogVersion(CAR, DK), '2026-11-17T09:00:00+00:00')
    await again.unmount()
  } finally {
    endCloudSession()
  }
})

test('C-2 거절인데 다시 읽기도 실패하면 "앱을 다시 켜서" 안내, Store 그대로', async () => {
  beginLoggedIn('u-c2', 'own-c2')
  conflictOnSave()
  handlers.daily_logs = { select: () => ({ data: null, error: { message: 'down' } }) }
  handlers.transport_details = { select: () => ({ data: [], error: null }) }
  const view = await mount('own-c2')
  try {
    await view.edit(1)
    await view.settle()
    assert.deepEqual(view.toasts, [CONFLICT_HEAD + '앱을 다시 켜서 최신 내용을 확인해 주세요.'])
    assert.equal(readOwnerWorkData('own-c2')[DK], undefined)
    assert.equal(view.latest.current?.autoSaveStatus, 'failed')
  } finally {
    await view.unmount()
    endCloudSession()
  }
})

test('C-3 일반 실패면 그날 내용과 실패 때 알던 시각을 같이 보관', async () => {
  beginLoggedIn('u-c3', 'own-c3')
  setDayLogVersion(CAR, DK, 'v-old')
  handlers.rpc = { save_day_log: () => { throw new Error('network down') } }
  const view = await mount('own-c3')
  try {
    await view.edit(3)
    await view.settle()
    assert.equal(getFailedDayLogPatch('own-c3', 'main', DK)?.fixedCount, 3)
    assert.equal(getFailedDayLogBase('own-c3', 'main', DK), 'v-old')
  } finally {
    await view.unmount()
    endCloudSession()
  }
})

test('C-4 보관 내용을 다시 저장할 때는 보관한 시각으로 확인, 거절이면 보관 내용 버림', async () => {
  beginLoggedIn('u-c4', 'own-c4')
  setDayLogVersion(CAR, DK, 'v-newer')
  addFailedDayLogDate('own-c4', 'main', DK, { isOff: false, fixedCount: 4, palletCount: 0, callDetails: [], fixedRouteCounts: {} }, 'v-base')
  conflictOnSave()
  serverDayIs7()
  const view = await mount('own-c4')
  try {
    await view.settle()
    assert.deepEqual(sentBases(), ['v-base'])
    assert.ok(view.toasts.includes(CONFLICT_HEAD + '일지를 닫았다가 다시 열면 최신 내용이 보입니다.'))
    assert.equal(getFailedDayLogPatch('own-c4', 'main', DK), undefined)
    assert.deepEqual(listFailedDayLogDates('own-c4'), [{ logId: 'main', dateKey: DK }])
  } finally {
    await view.unmount()
    endCloudSession()
  }
})

test('C-5 시각 없이 보관된 옛 항목은 지금 알던 시각으로 다시 저장', async () => {
  beginLoggedIn('u-c5', 'own-c5')
  setDayLogVersion(CAR, DK, 'v-current')
  addFailedDayLogDate('own-c5', 'main', DK, { isOff: false, fixedCount: 5, palletCount: 0, callDetails: [], fixedRouteCounts: {} })
  handlers.rpc = { save_day_log: () => ({ data: 'v-after', error: null }) }
  const view = await mount('own-c5')
  try {
    await view.settle()
    assert.deepEqual(sentBases(), ['v-current'])
    assert.deepEqual(listFailedDayLogDates('own-c5'), [])
  } finally {
    await view.unmount()
    endCloudSession()
  }
})
