import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { clientRowsFor, createFakeSupabase, vehicleRowsFor, wait } from '../testSupport/fakeSupabaseClient.ts'

const { fakeSupabase, handlers, resetHandlers, countOf, emptyOkHandlers } = createFakeSupabase()
fakeSupabase.auth.getSession = async () => ({
  data: { session: { user: { id: 'user-boot-nav', user_metadata: {}, phone: null } } },
  error: null,
})
mock.module('../data/cloud/supabaseClient.ts', {
  namedExports: {
    supabase: fakeSupabase,
    getSupabaseAuthErrorMessage: (error) => error?.message || '',
    signInWithGoogle: async () => ({ error: new Error('테스트에서 호출되면 안 됨') }),
    ensureProfileRow: async () => {},
  },
})

resetHandlers()
Object.assign(handlers, emptyOkHandlers())
handlers.profiles.select = () => ({ data: { id: 'user-boot-nav', name: '테스트 사용자', settings: {} }, error: null })
handlers.clients.insert = () => ({ data: { id: `fake-client-${Math.random().toString(36).slice(2, 8)}` }, error: null })
handlers.vehicles.insert = () => ({ data: { id: `fake-vehicle-${Math.random().toString(36).slice(2, 8)}` }, error: null })
handlers.daily_logs = {
  select: () => ({ data: [], error: null }),
  upsert: () => ({ data: { id: 9000 }, error: null }),
}
handlers.transport_details = { select: () => ({ data: [], error: null }) }
handlers.support_inquiries = { select: () => ({ data: [], error: null }) }
handlers.fuel_records = { select: () => ({ data: [], error: null }) }
handlers.maintenance_records = { select: () => ({ data: [], error: null }) }
handlers.misc_expense_records = { select: () => ({ data: [], error: null }) }
handlers.rpc = {
  is_admin: () => ({ data: null, error: null }),
  settle_expired_driver_unlinks: () => ({ data: null, error: null }),
  save_day_log: () => ({ data: null, error: null }),
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { act } = React
const { createRoot } = await import('react-dom/client')
const liveRoots = new Set()
function createTrackedRoot(container) {
  const root = createRoot(container)
  liveRoots.add(root)
  return root
}
async function unmountTracked(root) {
  liveRoots.delete(root)
  await act(async () => { root.unmount() })
}
const { BrowserRouter } = await import('react-router-dom')
const { default: App } = await import('./App.tsx')
const { commitCars, commitClients, commitExpenses, commitSettings, commitWorkData } = await import('../data/store/commitHelpers.ts')
const { pendingDayWriteCount, getPendingDayWrite } = await import('../data/sync/pendingWorkDataWrites.ts')
const { isDurableWriteBroken, hasUnsafeRegistration } = await import('../data/sync/durableWriteGuard.ts')
test.afterEach(async () => {
  const leftover = [...liveRoots]
  liveRoots.clear()
  for (const leftoverRoot of leftover) {
    await act(async () => { leftoverRoot.unmount() })
  }
  handlers.vehicles.select = () => ({ data: [], error: null })
  handlers.clients.select = () => ({ data: [], error: null })
})
const { getState } = await import('../data/store/app-store.ts')
const { readJsonKey, storageKeyFor } = await import('../data/store/persist.ts')
const { todayWorkLogSelection } = await import('../domain/calendar.ts')
const { normalizeSettings } = await import('../domain/practiceSettings.ts')

/** @typedef {import('../domain/dayRecordTypes.ts').DayRecordLike} DayRecordLike */

/** @param {string} ownerKey @returns {Record<string, DayRecordLike>} */
function readWorkData(ownerKey) {
  const main = getState().workLogs[ownerKey]?.main
  if (main && typeof main === 'object') return /** @type {Record<string, DayRecordLike>} */ (main)
  return readJsonKey('workData', ownerKey, /** @type {Record<string, DayRecordLike>} */ ({}))
}
/** @param {string} ownerKey @param {string} dateKey @returns {DayRecordLike|undefined} */
function committedRecord(ownerKey, dateKey) {
  const main = getState().workLogs[ownerKey]?.main
  return main ? (/** @type {Record<string, DayRecordLike>} */ (main))[dateKey] : undefined
}

/** @param {string} expectedFirstArg */
function spyConsoleError(expectedFirstArg) {
  const original = console.error
  let count = 0
  const spy = mock.method(console, 'error', /** @param {Array<string|Error>} args */ function patchedConsoleError(...args) {
    if (args[0] === expectedFirstArg) count += 1
    return original.apply(console, args)
  })
  return { count: () => count, restore: () => spy.mock.restore() }
}

async function waitUntil(predicate, { timeoutMs = 2000, stepMs = 20 } = {}) {
  await act(async () => {
    const deadline = Date.now() + timeoutMs
    while (!predicate() && Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      await wait(stepMs)
    }
  })
}

function setNativeInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}

/**
 * @param {ParentNode} root
 * @param {string} selector
 * @returns {HTMLInputElement}
 */
function requireHtmlInput(root, selector) {
  const el = root.querySelector(selector)
  if (!(el instanceof window.HTMLInputElement)) throw new Error(`HTMLInputElement가 필요합니다: ${selector}`)
  return /** @type {HTMLInputElement} */ (el)
}

function captureDayLogSaves(shouldFail = () => false) {
  /** @type {Array<{ work_date?: string, fixed_count?: number }>} */
  const rows = []
  const previous = handlers.rpc
  handlers.rpc = {
    ...(previous || {}),
    save_day_log: (/** @type {{ p_log?: { work_date?: string, fixed_count?: number } }} */ args) => {
      if (shouldFail()) throw new Error('save_day_log down (simulated)')
      rows.push(args?.p_log || {})
      return { data: 9001, error: null }
    },
  }
  return {
    rows,
    /** @param {string} dateKey */
    forDate(dateKey) {
      return rows.filter((row) => row.work_date === dateKey)
    },
    restore() {
      if (previous) handlers.rpc = previous
      else delete handlers.rpc
    },
  }
}

test('로그인 계정이 라우트를 이동해도 그 경로에 머물고 부트가 재실행되지 않는다', async () => {
  window.history.pushState({}, '', '/')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)

  try {
    await act(async () => {
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })

    await waitUntil(() => window.location.pathname === '/app')
    assert.equal(window.location.pathname, '/app', '부트 복원 후 /app에 도착해야 한다')
    const bootProfileCalls = countOf('profiles', 'select')
    assert.ok(bootProfileCalls >= 1, '부트 중 profiles 조회가 최소 1번은 나가야 한다')

    const myPageButton = Array.from(container.querySelectorAll('button'))
      .find((btn) => btn.textContent.includes('마이페이지'))
    assert.ok(myPageButton, '하단 탭에서 마이페이지 버튼을 찾아야 한다')

    await act(async () => {
      myPageButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    assert.equal(window.location.pathname, '/app/me', '클릭 직후에는 /app/me로 이동해야 한다')

    await act(async () => { await wait(600) })

    assert.equal(window.location.pathname, '/app/me', '라우트 이동 후 시간이 지나도 그 경로에 그대로 머물러야 한다(부트 재실행으로 /app에 되돌아가면 안 된다)')
    assert.equal(countOf('profiles', 'select'), bootProfileCalls, 'restoreSessionOnBoot()이 라우트 전환으로 재실행되면 안 된다(profiles 조회 횟수가 늘면 안 된다)')
  } finally {
    await unmountTracked(root)
    container.remove()
  }
})

test('재감사 4번 — 로그인 세션 복원 상태로 /app?y=2026&m=6을 렌더하면 pathname과 search가 그대로 보존된다', async () => {
  window.history.pushState({}, '', '/app?y=2026&m=6')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)

  try {
    await act(async () => {
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })

    await waitUntil(() => !container.querySelector('.boot-loading'))
    await act(async () => { await wait(50) })

    assert.equal(window.location.pathname, '/app', '로그인 상태에서도 /app 경로에 있어야 한다')
    assert.equal(window.location.search, '?y=2026&m=6', '부트 복원이 달력 월 쿼리를 지우면 안 된다(고쳤던 버그)')
  } finally {
    await unmountTracked(root)
    container.remove()
  }
})

test('재감사 9차 FAIL 지적 4번 — 존재하지 않는 달력 날짜로 /app/day/2026-02-30에 진입하면 DayLogPage가 렌더되지 않고 /app/calendar로 replace된다', async () => {
  const ownerKey = 'user-boot-nav'
  window.history.pushState({}, '', '/app/day/2026-02-30')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)

  try {
    await act(async () => {
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })
    await waitUntil(() => window.location.pathname === '/app/calendar', { timeoutMs: 3000 })

    assert.equal(window.location.pathname, '/app/calendar', '잘못된 달력 날짜는 /app/calendar로 replace돼야 한다')
    assert.equal(container.querySelector('#modalFixedCountInput'), null, 'DayLogPage(일지 입력 화면)가 렌더되면 안 된다')
    assert.equal(committedRecord(ownerKey, '2026-02-30'), undefined, '존재하지 않는 날짜로는 아무 것도 저장되면 안 된다')
    assert.equal(readWorkData(ownerKey)['2026-02-30'], undefined, 'localStorage에도 저장되면 안 된다')
  } finally {
    await unmountTracked(root)
    container.remove()
  }
})

test('재감사 4번 — store 구독: 마운트 후 외부에서 커밋한 workData를 CalendarPage/WorkLogPage가 보고, 한 날짜 편집이 다른 날짜를 지우지 않는다', async () => {
  window.history.pushState({}, '', '/app/calendar?y=2026&m=7')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)
  const ownerKey = 'user-boot-nav'

  try {
    await act(async () => {
      seedMainCar(ownerKey)
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })
    await waitUntil(() => window.location.pathname === '/app/calendar')
    await waitUntil(() => !container.querySelector('.boot-loading'))
    await act(async () => { await wait(50) })

    const B = {
      '2026-08-05': { isOff: false, fixedCount: 2, palletCount: 0, callDetails: [], fixedRouteCounts: {} },
      '2026-08-06': { isOff: false, fixedCount: 5, palletCount: 0, callDetails: [], fixedRouteCounts: {} },
    }
    await act(async () => { commitWorkData(ownerKey, B) })

    const cell6 = Array.from(container.querySelectorAll('button.date-cell'))
      .find((btn) => btn.querySelector('.cell-date-text')?.textContent === '6' && !btn.disabled)
    assert.ok(cell6, '8월 6일 셀을 찾아야 한다')
    assert.ok(
      cell6.textContent.includes('5회'),
      '마운트 후 외부에서 store에 커밋한 B(5회)가 달력에 이미 반영돼 있어야 한다(store 구독 증거) — 실제 텍스트: ' + cell6.textContent,
    )

    await act(async () => {
      cell6.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await waitUntil(() => window.location.pathname === '/app/day/2026-08-06')

    const countInput = requireHtmlInput(container, '#modalFixedCountInput')
    assert.ok(countInput, '일지의 운행 횟수 입력을 찾아야 한다')
    assert.equal(countInput.value, '5', 'WorkLogPage가 store의 최신값(B, 5회)을 받아야 한다 — 로컬 스냅샷의 예전(빈) 값이 아니다')

    await act(async () => { setNativeInputValue(countInput, '3') })

    await waitUntil(() => getState().workLogs[ownerKey]?.main?.['2026-08-06']?.fixedCount === 3)

    const storeData = getState().workLogs[ownerKey]?.main
    assert.equal(storeData?.['2026-08-06']?.fixedCount, 3, '편집한 8/6은 store에서 3으로 바뀌어야 한다')
    assert.equal(storeData?.['2026-08-05']?.fixedCount, 2, '건드리지 않은 8/5가 store에서 유실되면 안 된다')

    const persisted = readWorkData(ownerKey)
    assert.equal(persisted?.['2026-08-06']?.fixedCount, 3, 'localStorage도 store와 같은 값(8/6=3)이어야 한다')
    assert.equal(persisted?.['2026-08-05']?.fixedCount, 2, 'localStorage에서도 8/5가 유실되면 안 된다')

    await act(async () => { await wait(650) })
  } finally {
    await unmountTracked(root)
    container.remove()
  }
})

test('Step 6 — 일지 디바운스 커밋 + 언마운트 flush + 빈 날 삭제', async () => {
  window.history.pushState({}, '', '/app/day/2026-08-10')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)
  const ownerKey = 'user-boot-nav'
  const dateKey = '2026-08-10'
  handlers.rpc.remove_day_log = () => ({ data: null, error: null })

  try {
    await act(async () => {
      seedMainCar(ownerKey)
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })
    await waitUntil(() => !!container.querySelector('#modalFixedCountInput'))

    const countInput = requireHtmlInput(container, '#modalFixedCountInput')
    await act(async () => { setNativeInputValue(countInput, '4') })

    assert.equal(countInput.value, '4', '입력값은 즉시 화면에 반영돼야 한다')
    assert.equal(getState().workLogs[ownerKey]?.main?.[dateKey], undefined, '디바운스가 끝나기 전에는 store에 아직 반영되면 안 된다')
    assert.equal(readWorkData(ownerKey)[dateKey], undefined, '디바운스가 끝나기 전에는 localStorage에도 아직 반영되면 안 된다')

    await waitUntil(() => getState().workLogs[ownerKey]?.main?.[dateKey]?.fixedCount === 4, { timeoutMs: 2000 })
    assert.equal(readWorkData(ownerKey)[dateKey]?.fixedCount, 4, '디바운스가 끝나면 localStorage도 store와 같은 값이어야 한다')

    await act(async () => { setNativeInputValue(countInput, '7') })
    assert.equal(getState().workLogs[ownerKey]?.main?.[dateKey]?.fixedCount, 4, '아직 디바운스 전이라 store는 이전 값(4)이어야 한다')

    const backButton = Array.from(container.querySelectorAll('button')).find((btn) => btn.title === '뒤로가기')
    assert.ok(backButton, '일지의 뒤로가기 버튼을 찾아야 한다')
    await act(async () => {
      backButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await waitUntil(() => window.location.pathname === '/app/calendar')

    assert.equal(getState().workLogs[ownerKey]?.main?.[dateKey]?.fixedCount, 7, '언마운트(뒤로가기) 시점에 밀린 편집(7)이 즉시 flush돼야 한다')
    assert.equal(readWorkData(ownerKey)[dateKey]?.fixedCount, 7, 'localStorage에도 flush된 값이 반영돼야 한다')

    await act(async () => {
      window.history.pushState({}, '', `/app/day/${dateKey}`)
      window.dispatchEvent(new window.PopStateEvent('popstate'))
    })
    await waitUntil(() => !!container.querySelector('#modalFixedCountInput'))
    assert.equal(requireHtmlInput(container, '#modalFixedCountInput').value, '7', '재진입 시 flush된 값(7)을 그대로 보여줘야 한다')

    await act(async () => { setNativeInputValue(container.querySelector('#modalFixedCountInput'), '0') })
    await waitUntil(() => getState().workLogs[ownerKey]?.main?.[dateKey] === undefined, { timeoutMs: 2000 })
    assert.equal(readWorkData(ownerKey)[dateKey], undefined, '빈 날은 localStorage에서도 키 자체가 지워져야 한다')
  } finally {
    await unmountTracked(root)
    container.remove()
  }
})

test('재감사 FAIL 지적 1번 — 과거 일지에서 오늘 날짜 일지로 바로 이동해도 A의 draft가 B를 덮지 않고, A의 밀린 편집은 A에만 flush된다', async () => {
  const ownerKey = 'user-boot-nav'
  const dateA = '2026-08-01'
  const { dateKey: dateB } = todayWorkLogSelection()
  window.history.pushState({}, '', '/app')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)

  try {
    await act(async () => {
      seedMainCar(ownerKey)
      commitWorkData(ownerKey, {
        [dateA]: { isOff: false, fixedCount: 2, palletCount: 0, callDetails: [], fixedRouteCounts: {} },
        [dateB]: { isOff: false, fixedCount: 6, palletCount: 0, callDetails: [], fixedRouteCounts: {} },
      })
      const main = getState().workLogs[ownerKey]?.main || {}
      handlers.daily_logs = {
        ...(handlers.daily_logs || {}),
        select: () => ({
          data: Object.keys(main).map((work_date) => ({
            work_date, vehicle_id: 501, is_off: false, fixed_count: main[work_date]?.fixedCount || 0, raw: main[work_date] || {},
          })),
          error: null,
        }),
      }
    })
    await act(async () => {
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })
    await waitUntil(() => window.location.pathname === '/app')
    await act(async () => { await wait(50) })

    await act(async () => {
      window.history.pushState({}, '', `/app/day/${dateA}`)
      window.dispatchEvent(new window.PopStateEvent('popstate'))
    })
    await waitUntil(() => !!container.querySelector('#modalFixedCountInput'))
    assert.equal(requireHtmlInput(container, '#modalFixedCountInput').value, '2', 'A는 자기 원래 값(2)으로 열려야 한다')

    await act(async () => { setNativeInputValue(container.querySelector('#modalFixedCountInput'), '9') })

    await act(async () => {
      window.history.pushState({}, '', `/app/day/${dateB}`)
      window.dispatchEvent(new window.PopStateEvent('popstate'))
    })
    await waitUntil(() => window.location.pathname === `/app/day/${dateB}`)
    await waitUntil(() => !!container.querySelector('#modalFixedCountInput'))

    assert.equal(requireHtmlInput(container, '#modalFixedCountInput').value, '6', 'B는 자기 원래 값(6)으로 떠야 한다 — A의 draft(9)가 새어 들어오면 안 된다')

    await waitUntil(() => getState().workLogs[ownerKey]?.main?.[dateA]?.fixedCount === 9, { timeoutMs: 2000 })
    assert.equal(getState().workLogs[ownerKey]?.main?.[dateA]?.fixedCount, 9, 'A에 걸려 있던 편집은 A에 flush돼야 한다')
    assert.equal(getState().workLogs[ownerKey]?.main?.[dateB]?.fixedCount, 6, 'B는 원래 값 그대로여야 한다 — A의 값(9)으로 덮이면 안 된다')

    await act(async () => { await wait(700) })
    assert.equal(getState().workLogs[ownerKey]?.main?.[dateB]?.fixedCount, 6, '시간이 더 지나도 B가 A(9)로 덮이면 안 된다')
    assert.equal(readWorkData(ownerKey)[dateB]?.fixedCount, 6, 'localStorage에서도 B는 그대로여야 한다')
    assert.equal(readWorkData(ownerKey)[dateA]?.fixedCount, 9, 'localStorage에서도 A는 flush된 값이어야 한다')
  } finally {
    await unmountTracked(root)
    container.remove()
  }
})

test('재감사 FAIL 지적 8번 — 커밋마다 콜상세의 중첩 payments/commissionSnapshot이 store에서 새 참조로 바뀐다(draft와 참조 공유 안 함)', async () => {
  const ownerKey = 'user-boot-nav'
  const dateKey = '2026-08-16'
  window.history.pushState({}, '', '/app')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)

  try {
    await act(async () => {
      seedMainCar(ownerKey)
      commitWorkData(ownerKey, {
        [dateKey]: {
          isOff: false,
          fixedCount: 1,
          callDetails: [{
            id: 'c1', fare: '10,000', client: '한진',
            payments: [{ id: 'p1', amount: 5000, paidAt: '2026-08-01T00:00:00.000Z', note: '' }],
            commissionSnapshot: { enabled: true, type: 'percent', value: '10' },
          }],
          fixedRouteCounts: {},
        },
      })
      handlers.daily_logs = {
        ...(handlers.daily_logs || {}),
        select: () => ({
          data: [{
            work_date: dateKey, vehicle_id: 501, is_off: false, fixed_count: 1,
            raw: getState().workLogs[ownerKey]?.main?.[dateKey] || {},
          }],
          error: null,
        }),
      }
      handlers.transport_details = {
        ...(handlers.transport_details || {}),
        select: () => ({
          data: [{
            work_date: dateKey,
            sequence: 0,
            raw: {
              id: 'c1', fare: '10,000', client: '한진',
              payments: [{ id: 'p1', amount: 5000, paidAt: '2026-08-01T00:00:00.000Z', note: '' }],
              commissionSnapshot: { enabled: true, type: 'percent', value: '10' },
            },
          }],
          error: null,
        }),
      }
    })
    await act(async () => {
      window.history.pushState({}, '', `/app/day/${dateKey}`)
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })
    await waitUntil(() => !!container.querySelector('#modalFixedCountInput'))
    const before = getState().workLogs[ownerKey].main[dateKey].callDetails[0]

    await act(async () => { setNativeInputValue(container.querySelector('#modalFixedCountInput'), '3') })
    await waitUntil(() => getState().workLogs[ownerKey]?.main?.[dateKey]?.fixedCount === 3, { timeoutMs: 2000 })

    const after = getState().workLogs[ownerKey].main[dateKey].callDetails[0]
    assert.notEqual(after, before, 'callDetails[0] 자체가 새 참조여야 한다')
    assert.notEqual(after.payments, before.payments, 'payments 배열이 draft/store 사이에서 같은 참조로 남으면 안 된다')
    assert.notEqual(after.commissionSnapshot, before.commissionSnapshot, 'commissionSnapshot 객체가 같은 참조로 남으면 안 된다')
    assert.deepEqual(after.payments, before.payments, '참조만 다르고 값 자체는 그대로 보존돼야 한다')
    assert.deepEqual(after.commissionSnapshot, before.commissionSnapshot, '참조만 다르고 값 자체는 그대로 보존돼야 한다')
  } finally {
    await unmountTracked(root)
    container.remove()
  }
})

test('재감사 FAIL 지적 4번 — 고정노선+파렛트 거래처가 있으면 파렛트 섹션이 뜨고, 저장·재진입 후에도 값이 유지된다', async () => {
  const ownerKey = 'user-boot-nav'
  const dateKey = '2026-08-17'
  window.history.pushState({}, '', `/app/day/${dateKey}`)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)

  try {
    await act(async () => {
      seedPalletClient(ownerKey)
      seedMainCar(ownerKey)
    })
    await act(async () => {
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })
    await waitUntil(() => !!container.querySelector('#modalFixedCountInput'))

    const palletInput = requireHtmlInput(container, '#modalPalletCount')
    assert.ok(palletInput, '고정노선 연결 + palletOn 거래처가 있으면 파렛트 입력이 보여야 한다')

    await act(async () => { setNativeInputValue(palletInput, '5') })
    await waitUntil(() => getState().workLogs[ownerKey]?.main?.[dateKey]?.palletCount === 5, { timeoutMs: 2000 })
    assert.equal(readWorkData(ownerKey)[dateKey]?.palletCount, 5, 'localStorage에도 반영돼야 한다')

    await act(async () => {
      window.history.pushState({}, '', '/app')
      window.dispatchEvent(new window.PopStateEvent('popstate'))
    })
    await waitUntil(() => window.location.pathname === '/app')
    await act(async () => {
      window.history.pushState({}, '', `/app/day/${dateKey}`)
      window.dispatchEvent(new window.PopStateEvent('popstate'))
    })
    await waitUntil(() => !!container.querySelector('#modalPalletCount'))
    assert.equal(requireHtmlInput(container, '#modalPalletCount').value, '5', '재진입 시 저장된 파렛트 값을 그대로 보여줘야 한다')

    await act(async () => { await wait(650) })
  } finally {
    await unmountTracked(root)
    container.remove()
  }
})


/** @param {string} ownerKey */
function seedPalletClient(ownerKey) {
  const clients = [
    /** @type {import('../domain/clientTypes.ts').ClientLike} */ ({
      id: 'c1', companyName: '한진', fixedRouteLinked: true, palletOn: true,
      palletPrice: '10,000', fixedUnitPrice: '250,000', supabaseId: 601,
    }),
  ]
  commitClients(ownerKey, clients)
  handlers.clients.select = () => ({ data: clientRowsFor(clients), error: null })
  commitSettings(ownerKey, normalizeSettings({ fixedOn: true }))
}

/** @param {string} ownerKey */
function seedMainCar(ownerKey) {
  const cars = [
    /** @type {import('../domain/financeTypes.ts').CarLike} */ ({ id: 'car-main', type: 'main', number: '12가3456', supabaseId: 501 }),
  ]
  commitCars(ownerKey, cars)
  handlers.vehicles.select = () => ({ data: vehicleRowsFor(cars), error: null })
}


test('재감사 FAIL 지적 6번 — 콜상세 폼을 열면 비용 폼이 닫히고, 비용 폼을 열면 콜상세 폼이 닫힌다(두 폼이 동시에 DOM에 없다)', async () => {
  const ownerKey = 'user-boot-nav'
  const dateKey = '2026-08-19'
  window.history.pushState({}, '', `/app/day/${dateKey}`)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)

  try {
    await act(async () => {
      commitSettings(ownerKey, normalizeSettings({ fixedOn: true, callDetail: true }))
    })
    await act(async () => {
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })
    await waitUntil(() => !!container.querySelector('#modalFixedCountInput'))
    await act(async () => {
      commitSettings(ownerKey, normalizeSettings({ fixedOn: true, callDetail: true }))
    })

    const openCallBtn = container.querySelector('.call-detail-section .compact-add-btn')
    assert.ok(openCallBtn, '콜상세 섹션의 "+ 추가" 버튼을 찾아야 한다')
    await act(async () => {
      openCallBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    assert.ok(container.querySelector('.call-detail-modal-content'), '콜상세 폼이 DOM에 있어야 한다')
    const callSheet = container.querySelector('.call-detail-inline-host')
    assert.ok(callSheet?.classList.contains('is-visible'))
    assert.equal(callSheet?.getAttribute('aria-hidden'), 'false')
    assert.equal(callSheet?.hasAttribute('hidden'), false)
    assert.equal(container.querySelector('.maint-fuel-select-inline'), null, '비용 선택 패널은 아직 DOM에 없어야 한다')

    for (const label of ['+ 정비 추가', '+ 주유 추가', '+ 기타 추가']) {
      const kindBtn = Array.from(container.querySelectorAll('button')).find((btn) => (btn.textContent || '').includes(label))
      assert.ok(kindBtn, label)
      await act(async () => { kindBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })) })
      const expenseSheet = container.querySelector('.maint-fuel-inline-host')
      assert.ok(expenseSheet?.classList.contains('is-visible'), `${label} 시트가 열려야 한다`)
      assert.equal(expenseSheet?.getAttribute('aria-hidden'), 'false')
      assert.equal(container.querySelector('.call-detail-modal-content'), null, `${label} 후 콜 폼은 닫혀야 한다`)
      assert.ok(container.querySelector('#expenseCost'), `${label} 비용 입력이 보여야 한다`)
    }

    const openExpenseBtn = container.querySelector('.maint-section .compact-add-btn')
    assert.ok(openExpenseBtn, '비용 섹션의 "+ 추가" 버튼을 찾아야 한다')
    await act(async () => {
      openExpenseBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    assert.ok(container.querySelector('.maint-fuel-select-inline'), '비용 선택 패널이 DOM에 있어야 한다')
    assert.equal(container.querySelector('.call-detail-modal-content'), null, '비용 폼을 열면 콜상세 폼은 DOM에서 사라져야 한다(동시 존재 금지)')
  } finally {
    await unmountTracked(root)
    container.remove()
  }
})


test('재감사 2차 FAIL 지적 2번 — 비용 저장이 그 사이 store에 추가된 다른 비용을 덮어쓰지 않는다', async () => {
  const ownerKey = 'user-boot-nav'
  const dateKey = '2026-08-21'
  handlers.maintenance_records.insert = () => ({ data: null, error: null })
  handlers.misc_expense_records.insert = () => ({ data: null, error: null })
  window.history.pushState({}, '', `/app/day/${dateKey}`)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)

  try {
    const e1 = { id: 'e1', kind: 'maint', date: dateKey, name: '오일', category: '엔진/미션', payment: '카드', cost: 10000 }
    await act(async () => { commitExpenses(ownerKey, [e1]) })

    await act(async () => {
      seedMainCar(ownerKey)
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })
    await waitUntil(() => !!container.querySelector('.maint-section'))

    const e2 = { id: 'e2', kind: 'misc', date: dateKey, name: '주차비', category: '주차비', payment: '카드', cost: 3000 }
    await act(async () => { commitExpenses(ownerKey, [e1, e2]) })

    const addMaintBtn = Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent.includes('+ 정비 추가'))
    assert.ok(addMaintBtn, '"+ 정비 추가" 버튼을 찾아야 한다')
    await act(async () => { addMaintBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })) })

    const nameInput = container.querySelector('#expenseName')
    assert.ok(nameInput, '정비 항목명 입력을 찾아야 한다')
    await act(async () => { setNativeInputValue(nameInput, '타이어 교체') })
    const costInput = container.querySelector('#expenseCost')
    await act(async () => { setNativeInputValue(costInput, '20000') })

    const saveBtn = Array.from(container.querySelectorAll('.modal-btn.confirm')).find((btn) => btn.textContent === '저장')
    assert.ok(saveBtn, '저장 버튼을 찾아야 한다')
    await act(async () => { saveBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })) })

    await waitUntil(() => (getState().expenses[ownerKey] || []).some((item) => item.name === '타이어 교체'))
    const stored = getState().expenses[ownerKey] || []
    assert.equal(stored.length, 3, `e1, e2(화면이 모르던 것), 신규 항목까지 3건이어야 한다 — 실제: ${JSON.stringify(stored)}`)
    assert.ok(stored.some((item) => item.id === 'e1'), 'e1이 남아 있어야 한다')
    assert.ok(stored.some((item) => item.id === 'e2'), '화면이 모르는 사이 추가된 e2가 저장 후에도 살아남아야 한다(덮어쓰기 금지)')
    assert.ok(stored.some((item) => item.name === '타이어 교체'), '새로 입력한 항목도 저장돼야 한다')

    await act(async () => { await wait(650) })
  } finally {
    await unmountTracked(root)
    container.remove()
  }
})








test('슬라이스 D — 로그인 클라우드 일지: 서버 upsert 실패는 Fail-Fast(저장 실패 상태 + 네트워크 토스트)이고 durable 큐에 새 항목이 없다. 복구 후 재편집이 서버·Store로 수렴한다', async () => {
  const ownerKey = 'user-boot-nav'
  const dateKey = '2026-10-02'
  window.history.pushState({}, '', '/app/day/' + dateKey)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)

  let serverShouldFail = false
  const prevDailyLogs = handlers.daily_logs
  const prevRpc = handlers.rpc
  handlers.daily_logs = {
    ...(prevDailyLogs || {}),
    select: () => ({ data: [{ work_date: dateKey, vehicle_id: 501, is_off: false, fixed_count: 2, raw: { palletCount: 0, fixedRouteCounts: {} } }], error: null }),
  }
  const dailyLogs = captureDayLogSaves(() => serverShouldFail)
  const errSpy = spyConsoleError('[commitMainDayLogToCloud] 일지 저장 실패:')

  try {
    await act(async () => {
      seedPalletClient(ownerKey)
      seedMainCar(ownerKey)
      commitWorkData(ownerKey, { [dateKey]: { isOff: false, fixedCount: 2, palletCount: 0, callDetails: [], fixedRouteCounts: {} } })
    })
    await act(async () => { root.render(React.createElement(BrowserRouter, null, React.createElement(App))) })
    await waitUntil(() => !!container.querySelector('#modalFixedCountInput'))
    await waitUntil(() => committedRecord(ownerKey, dateKey)?.fixedCount === 2, { timeoutMs: 3000 })

    serverShouldFail = true
    await act(async () => { setNativeInputValue(requireHtmlInput(container, '#modalFixedCountInput'), '8') })
    await waitUntil(() => (container.querySelector('.autosave-status')?.textContent || '').includes('저장 실패'), { timeoutMs: 2000 })

    assert.equal(committedRecord(ownerKey, dateKey)?.fixedCount, 2, '실패 시 Store는 저장 전 값(2)')
    assert.equal(readWorkData(ownerKey)[dateKey]?.fixedCount, 2, '실패 시 localStorage도 저장 전 값')
    assert.equal(pendingDayWriteCount(), 0, '로그인 Fail-Fast는 durable 큐에 새 항목을 넣지 않는다')
    assert.equal(getPendingDayWrite(ownerKey, dateKey), undefined)
    assert.equal(hasUnsafeRegistration(ownerKey, dateKey), true, '로드맵 35: 실패한 날짜는 나가기 전 확인 목록에 올라가야 한다')
    const toastText = container.querySelector('.toast-message')?.textContent || ''
    assert.match(toastText, /네트워크 상태를 확인해 주세요/)
    assert.equal(toastText.includes('저장 공간'), false, '로그인 원격 실패에 quota 문구를 쓰면 안 된다')
    assert.equal((container.querySelector('.autosave-status')?.textContent || '').includes('저장 완료'), false)
    assert.equal(errSpy.count(), 1)

    serverShouldFail = false
    const upsertsBefore = dailyLogs.forDate(dateKey).length
    await act(async () => { setNativeInputValue(requireHtmlInput(container, '#modalFixedCountInput'), '9') })
    await waitUntil(() => committedRecord(ownerKey, dateKey)?.fixedCount === 9, { timeoutMs: 2000 })
    assert.equal(readWorkData(ownerKey)[dateKey]?.fixedCount, 9)
    assert.equal(dailyLogs.forDate(dateKey).length > upsertsBefore, true, '재편집이 그 날짜 일지 서버 저장(save_day_log)을 냈어야 한다')
    assert.equal(hasUnsafeRegistration(ownerKey, dateKey), false, '재저장 성공 뒤엔 확인 목록에서 내려가야 한다')
    assert.equal(pendingDayWriteCount(), 0)
    assert.equal(errSpy.count(), 1, '복구 성공 뒤 console.error가 늘면 안 된다')
  } finally {
    errSpy.restore()
    dailyLogs.restore()
    handlers.daily_logs = prevDailyLogs
    if (prevRpc) handlers.rpc = prevRpc
    else delete handlers.rpc
    if (liveRoots.has(root)) { await unmountTracked(root); container.remove() }
  }
})

test('로드맵 35 — 로그인 일지 서버 저장 실패 중 뒤로가기: 확인 창이 뜨고 [취소]면 남고 [확인]이면 나간 뒤 표시가 남지 않는다', async () => {
  const ownerKey = 'user-boot-nav'
  const dateKey = '2026-10-04'
  window.history.pushState({}, '', '/app/day/' + dateKey)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)
  const prevDailyLogs = handlers.daily_logs
  const prevRpc = handlers.rpc
  handlers.daily_logs = {
    ...(prevDailyLogs || {}),
    select: () => ({ data: [{ work_date: dateKey, vehicle_id: 501, is_off: false, fixed_count: 2, raw: { palletCount: 0, fixedRouteCounts: {} } }], error: null }),
  }
  let serverShouldFail = false
  const dailyLogs = captureDayLogSaves(() => serverShouldFail)
  const errSpy = spyConsoleError('[commitMainDayLogToCloud] 일지 저장 실패:')
  const prevConfirm = window.confirm
  /** @type {Array<string>} */
  const confirmCalls = []
  let confirmAnswer = false
  window.confirm = (message) => { confirmCalls.push(String(message)); return confirmAnswer }
  const clickBack = async () => {
    const backButton = Array.from(container.querySelectorAll('button')).find((btn) => btn.title === '뒤로가기')
    assert.ok(backButton, '일지의 뒤로가기 버튼을 찾아야 한다')
    await act(async () => { backButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })) })
  }

  try {
    await act(async () => {
      seedPalletClient(ownerKey)
      seedMainCar(ownerKey)
      commitWorkData(ownerKey, { [dateKey]: { isOff: false, fixedCount: 2, palletCount: 0, callDetails: [], fixedRouteCounts: {} } })
    })
    await act(async () => { root.render(React.createElement(BrowserRouter, null, React.createElement(App))) })
    await waitUntil(() => !!container.querySelector('#modalFixedCountInput'))

    serverShouldFail = true
    await act(async () => { setNativeInputValue(requireHtmlInput(container, '#modalFixedCountInput'), '8') })
    await waitUntil(() => (container.querySelector('.autosave-status')?.textContent || '').includes('저장 실패'), { timeoutMs: 2000 })
    assert.equal(isDurableWriteBroken(), true, '저장 실패 중엔 나가기 전 확인 대상이어야 한다')

    await clickBack()
    assert.equal(confirmCalls.length, 1, '뒤로가기에서 확인 창이 1번 떠야 한다')
    assert.match(confirmCalls[0], /아직 저장되지 않았습니다/)
    assert.equal(window.location.pathname, '/app/day/' + dateKey, '[취소]면 일지 화면에 남아야 한다')
    assert.equal(requireHtmlInput(container, '#modalFixedCountInput').value, '8', '[취소] 뒤에도 고친 값이 화면에 남아야 한다')

    confirmAnswer = true
    await clickBack()
    await waitUntil(() => window.location.pathname === '/app/calendar')
    await waitUntil(() => errSpy.count() === 2, { timeoutMs: 2000 })
    assert.equal(confirmCalls.length, 2)
    assert.equal(hasUnsafeRegistration(ownerKey, dateKey), false, '나간 뒤 마지막 시도가 실패해도 표시가 다시 올라가면 안 된다')
    assert.equal(isDurableWriteBroken(), false, '나간 뒤 다른 화면 이동에 확인 창이 또 뜨면 안 된다')
    assert.equal(committedRecord(ownerKey, dateKey)?.fixedCount, 2, '서버 실패라 Store는 저장 전 값')
    assert.equal(pendingDayWriteCount(), 0, '재시도 큐는 없다')
  } finally {
    window.confirm = prevConfirm
    errSpy.restore()
    dailyLogs.restore()
    handlers.daily_logs = prevDailyLogs
    if (prevRpc) handlers.rpc = prevRpc
    else delete handlers.rpc
    if (liveRoots.has(root)) { await unmountTracked(root); container.remove() }
  }
})

test('슬라이스 D — 로그인 클라우드 일지: 서버 저장은 성공했지만 로컬 persist가 quota로 막히면 Fail-Fast 상태만, durable/tombstone은 안 쌓인다', async () => {
  const ownerKey = 'user-boot-nav'
  const dateKey = '2026-10-03'
  window.history.pushState({}, '', '/app/day/' + dateKey)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)
  const prevDailyLogs = handlers.daily_logs
  handlers.daily_logs = { ...(prevDailyLogs || {}), select: () => ({ data: [{ work_date: dateKey, vehicle_id: 501, is_off: false, fixed_count: 2, raw: { palletCount: 0, fixedRouteCounts: {} } }], error: null }) }
  const dailyLogs = captureDayLogSaves()

  const proto = Object.getPrototypeOf(localStorage)
  const originalSetItem = proto.setItem
  const failKey = storageKeyFor('workData', ownerKey)
  const tombstoneKey = storageKeyFor('workDataDeletedDates', ownerKey)
  let shouldFail = false
  const spy = mock.method(proto, 'setItem', /** @this {Storage} @param {string} key @param {string} value */ function patchedSetItem(key, value) {
    if (shouldFail && key === failKey) throw new Error('quota exceeded (simulated, slice D login)')
    return originalSetItem.call(this, key, value)
  })
  const errSpy = spyConsoleError('[commitMainDayLogToCloud] 일지 저장 실패:')

  try {
    await act(async () => {
      seedPalletClient(ownerKey)
      seedMainCar(ownerKey)
      commitWorkData(ownerKey, { [dateKey]: { isOff: false, fixedCount: 2, palletCount: 0, callDetails: [], fixedRouteCounts: {} } })
    })
    await act(async () => { root.render(React.createElement(BrowserRouter, null, React.createElement(App))) })
    await waitUntil(() => !!container.querySelector('#modalFixedCountInput'))
    await waitUntil(() => committedRecord(ownerKey, dateKey)?.fixedCount === 2, { timeoutMs: 3000 })

    const tombstoneRawBefore = localStorage.getItem(tombstoneKey)
    const upsertsBefore = dailyLogs.forDate(dateKey).length
    shouldFail = true
    await act(async () => { setNativeInputValue(requireHtmlInput(container, '#modalFixedCountInput'), '8') })
    await waitUntil(() => committedRecord(ownerKey, dateKey)?.fixedCount === 8, { timeoutMs: 2000 })

    assert.equal(committedRecord(ownerKey, dateKey)?.fixedCount, 8, '슬라이스 E: 로그인 일지는 workData LS를 안 쓰므로 quota와 무관하게 서버 성공 후 Store가 갱신된다')
    assert.equal(pendingDayWriteCount(), 0, 'durable 큐에 새 항목이 없어야 한다')
    assert.equal(hasUnsafeRegistration(ownerKey, dateKey), false)
    assert.equal(localStorage.getItem(tombstoneKey), tombstoneRawBefore, '새 tombstone을 만들면 안 된다')
    assert.equal(dailyLogs.forDate(dateKey).length, upsertsBefore + 1, '일지 서버 저장(save_day_log)은 나갔다')
    assert.equal(errSpy.count(), 0)

    await act(async () => { setNativeInputValue(requireHtmlInput(container, '#modalFixedCountInput'), '9') })
    await waitUntil(() => committedRecord(ownerKey, dateKey)?.fixedCount === 9, { timeoutMs: 2000 })
    assert.equal(pendingDayWriteCount(), 0)
    assert.equal(errSpy.count(), 0)
  } finally {
    errSpy.restore()
    spy.mock.restore()
    shouldFail = false
    dailyLogs.restore()
    handlers.daily_logs = prevDailyLogs
    if (liveRoots.has(root)) { await unmountTracked(root); container.remove() }
  }
})

test('새 홈 1단계 — 달력 탭은 달력 화면, 홈 [운행 기록하기] → 오늘 일지 → 뒤로가기 → 홈', async () => {
  const { dateKey } = todayWorkLogSelection()
  window.history.pushState({}, '', '/app')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)
  /** @param {string} label */
  const navButton = (label) => Array.from(container.querySelectorAll('.bottom-nav-bar .nav-item'))
    .find((btn) => btn.textContent.trim() === label)

  try {
    await act(async () => {
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })
    await waitUntil(() => !!container.querySelector('.home-today-card'))
    assert.equal(window.location.pathname, '/app')
    assert.equal(container.querySelector('.calendar-grid'), null, '홈에는 달력이 없어야 한다')
    assert.deepEqual(
      Array.from(container.querySelectorAll('.bottom-nav-bar .nav-item')).map((btn) => btn.textContent.trim()),
      ['홈', '달력', '매출', '마이페이지'],
    )
    assert.ok(navButton('홈')?.classList.contains('active'), '홈에서는 홈 탭이 켜져야 한다')

    await act(async () => {
      navButton('달력')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await waitUntil(() => window.location.pathname === '/app/calendar')
    await waitUntil(() => !!container.querySelector('.calendar-grid'))
    assert.ok(navButton('달력')?.classList.contains('active'), '달력에서는 달력 탭이 켜져야 한다')

    await act(async () => {
      navButton('홈')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await waitUntil(() => !!container.querySelector('.home-today-btn'))
    await act(async () => {
      container.querySelector('.home-today-btn')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await waitUntil(() => window.location.pathname === `/app/day/${dateKey}`)
    await waitUntil(() => !!container.querySelector('#modalFixedCountInput'))
    assert.ok(navButton('달력')?.classList.contains('active'), '일지에서는 달력 탭이 켜져야 한다')

    const backButton = Array.from(container.querySelectorAll('button')).find((btn) => btn.title === '뒤로가기')
    assert.ok(backButton, '홈에서 연 일지에는 뒤로가기가 있어야 한다')
    await act(async () => {
      backButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await waitUntil(() => window.location.pathname === '/app')
    await waitUntil(() => !!container.querySelector('.home-today-card'))
  } finally {
    await unmountTracked(root)
    container.remove()
  }
})

test('알림 화면 — 알림 단추 → /app/notifications(옆 창 없음) → 뒤로가기 → 홈', async () => {
  window.history.pushState({}, '', '/app')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)
  try {
    await act(async () => {
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })
    await waitUntil(() => !!container.querySelector('.home-today-card'))
    const bell = Array.from(container.querySelectorAll('button')).find((btn) => btn.title === '알림')
    assert.ok(bell, '홈 위쪽 알림 종')
    await act(async () => { bell.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })) })
    await waitUntil(() => window.location.pathname === '/app/notifications')
    await waitUntil(() => !!container.querySelector('.notifications-page'))
    assert.equal(container.querySelector('.notification-panel'), null, '옛 옆 창은 없어야 한다')
    const homeTab = Array.from(container.querySelectorAll('.bottom-nav-bar .nav-item')).find((btn) => btn.textContent.trim() === '홈')
    assert.ok(homeTab?.classList.contains('active'), '알림 화면에선 홈 탭 강조')

    const back = Array.from(container.querySelectorAll('button')).find((btn) => btn.title === '뒤로가기')
    assert.ok(back)
    await act(async () => { back.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })) })
    await waitUntil(() => window.location.pathname === '/app')
    await waitUntil(() => !!container.querySelector('.home-today-card'))
  } finally {
    await unmountTracked(root)
    container.remove()
  }
})

test('로그인 계정 설정에서 다크 → 개인정보 [로그아웃] → 로그인 화면은 휴대폰 색(라이트), 마지막 테마 기억도 light', async () => {
  window.history.pushState({}, '', '/app/me/settings')
  handlers.profiles.upsert = () => ({ data: null, error: null })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createTrackedRoot(container)
  try {
    await act(async () => {
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })
    await waitUntil(() => !!container.querySelector('#theme-dark'), { timeoutMs: 5000 })
    const darkSwitch = container.querySelector('#theme-dark')
    assert.ok(darkSwitch, '설정 화면 테마 [다크] 단추')
    await act(async () => { darkSwitch.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })) })
    await waitUntil(() => document.documentElement.getAttribute('data-theme') === 'dark')
    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark', '설정에서 다크로 바꿈')

    await act(async () => {
      window.history.pushState({}, '', '/app/me/profile')
      window.dispatchEvent(new window.PopStateEvent('popstate'))
    })
    await waitUntil(() => Array.from(container.querySelectorAll('button')).some((btn) => btn.textContent.trim() === '로그아웃'), { timeoutMs: 5000 })
    const logout = Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent.trim() === '로그아웃')
    assert.ok(logout, '개인정보 화면 [로그아웃]')
    await act(async () => { logout.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })) })
    await waitUntil(() => !!container.querySelector('.auth-guest-btn'), { timeoutMs: 5000 })
    assert.equal(window.location.pathname, '/auth')
    await waitUntil(() => document.documentElement.getAttribute('data-theme') === null)
    assert.equal(document.documentElement.getAttribute('data-theme'), null, '로그아웃 뒤 로그인 화면은 휴대폰 색')
    assert.equal(localStorage.getItem('lastTheme'), 'light', '마지막 테마 기억도 휴대폰 색')
  } finally {
    await unmountTracked(root)
    container.remove()
    document.documentElement.removeAttribute('data-theme')
    localStorage.removeItem('lastTheme')
  }
})
