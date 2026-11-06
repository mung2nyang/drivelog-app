// @ts-check
// 휴대폰 알림 걸기 — 웹은 안 함, 처음 한 번만 허용 묻기, 거절이면 안 검, 값이 바뀌면 모두 지우고 다시, 누르면 그 화면, 로그아웃이면 모두 지움.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/stubSupabaseClient.js'
import '../../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

let native = true
let permission = 'prompt'
let requests = 0
/** @type {Array<Array<{ id: number }>>} */
const cancels = []
/** @type {Array<Array<{ id: number, title: string, largeIcon: string, isExactNotification: boolean, schedule: { at: Date, allowWhileIdle: boolean }, extra: { path: string } }>>} */
const schedules = []
/** @type {Array<{ id: number }>} */
let pending = []
/** @type {Array<(action: { notification: { extra: { path: string } } }) => void>} */
const taps = []

mock.module('@capacitor/core', { namedExports: { Capacitor: { isNativePlatform: () => native } } })
mock.module('@capacitor/app', { namedExports: { App: { addListener: async () => ({ remove: async () => {} }) } } })
// 진짜 플러그인처럼 모르는 이름(then 포함)은 휴대폰 기능 부르기로 바뀌어 실패한다.
const plugin = {
  checkPermissions: async () => ({ display: permission }),
  requestPermissions: async () => { requests += 1; permission = 'granted'; return { display: permission } },
  getPending: async () => ({ notifications: pending }),
  cancel: async (/** @type {{ notifications: Array<{ id: number }> }} */ options) => { cancels.push(options.notifications); pending = [] },
  schedule: async (/** @type {{ notifications: typeof schedules[number] }} */ options) => {
    schedules.push(options.notifications)
    pending = options.notifications.map(({ id }) => ({ id }))
  },
  addListener: async (/** @type {string} */ name, /** @type {typeof taps[number]} */ listener) => {
    assert.equal(name, 'localNotificationActionPerformed')
    taps.push(listener)
    return { remove: async () => { taps.splice(taps.indexOf(listener), 1) } }
  },
}
const pluginProxy = new Proxy(plugin, {
  get: (target, name) => (name in target ? Reflect.get(target, name) : () => Promise.reject(new Error(`"LocalNotifications.${String(name)}()" is not implemented on android`))),
})
mock.module('@capacitor/local-notifications', { namedExports: { LocalNotifications: pluginProxy } })

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { MemoryRouter, useLocation } = await import('react-router-dom')
const { commitDismissedNotifications } = await import('../../../data/store/commitHelpers.ts')
const { default: useDeviceNotices } = await import('./useDeviceNotices.ts')

const GUEST = { guestMode: true, name: '비회원' }
const flush = () => new Promise((resolve) => { setTimeout(resolve, 5) })

/** @param {() => boolean} check */
async function waitFor(check) {
  for (let i = 0; i < 60 && !check(); i += 1) await act(async () => { await flush() })
}

function reset() {
  native = true
  permission = 'prompt'
  requests = 0
  cancels.length = 0
  schedules.length = 0
  pending = [{ id: 99 }]
  taps.length = 0
  localStorage.clear()
  commitDismissedNotifications('guest', [])
}

/** @param {{ session: object|null }} initial */
async function mount(initial) {
  /** @type {(session: object|null) => void} */
  let setSession = () => {}
  let path = ''
  function Probe() {
    const [session, setSessionState] = React.useState(initial.session)
    setSession = setSessionState
    path = useLocation().pathname
    useDeviceNotices('guest', /** @type {import('../../../data/sync/syncTypes.ts').AppSession|null} */ (session), false, 0)
    return null
  }
  const container = document.createElement('div')
  const root = createRoot(container)
  await act(async () => { root.render(React.createElement(MemoryRouter, { initialEntries: ['/app'] }, React.createElement(Probe))) })
  return {
    path: () => path,
    setSession: async (/** @type {object|null} */ next) => { await act(async () => { setSession(next) }) },
    cleanup: async () => { await act(async () => { root.unmount() }) },
  }
}

test('웹이면 허용도 안 묻고 아무것도 안 건다', async () => {
  reset()
  native = false
  const view = await mount({ session: GUEST })
  try {
    for (let i = 0; i < 5; i += 1) await act(async () => { await flush() })
    assert.equal(requests, 0)
    assert.equal(schedules.length + cancels.length, 0)
  } finally { await view.cleanup() }
})

test('처음이면 한 번 허용을 묻고, 남은 알림을 지운 뒤 계획대로 건다', async () => {
  reset()
  const view = await mount({ session: GUEST })
  try {
    await waitFor(() => schedules.length > 0)
    assert.equal(requests, 1)
    assert.deepEqual(cancels[0], [{ id: 99 }], '먼저 걸려 있던 것을 지움')
    const backup = schedules[0].find((n) => n.title === '백업 권장')
    assert.ok(backup, '비회원 백업 알림')
    assert.equal(backup.largeIcon, 'ic_notice_large')
    assert.equal(backup.isExactNotification, false)
    assert.equal(backup.schedule.allowWhileIdle, true)
    assert.equal(backup.extra.path, '/app/me/settings')
    assert.deepEqual(schedules[0].map((n) => n.id), schedules[0].map((_, i) => i + 1))
  } finally { await view.cleanup() }
})

test('이미 거절했으면 다시 묻지 않고 걸지 않는다', async () => {
  reset()
  permission = 'denied'
  const view = await mount({ session: GUEST })
  try {
    for (let i = 0; i < 5; i += 1) await act(async () => { await flush() })
    assert.equal(requests, 0)
    assert.equal(schedules.length, 0)
  } finally { await view.cleanup() }
})

test('알림을 닫으면 모두 지우고 다시 건다(닫은 알림은 빠짐)', async () => {
  reset()
  permission = 'granted'
  const view = await mount({ session: GUEST })
  try {
    await waitFor(() => schedules.length > 0)
    await act(async () => { commitDismissedNotifications('guest', ['backup:never']) })
    await waitFor(() => schedules.length > 1)
    assert.equal(cancels.length, 2)
    assert.ok(!schedules[1].some((n) => n.title === '백업 권장'))
  } finally { await view.cleanup() }
})

test('휴대폰 알림을 누르면 그 화면으로 간다', async () => {
  reset()
  permission = 'granted'
  const view = await mount({ session: GUEST })
  try {
    await waitFor(() => taps.length > 0)
    await act(async () => { taps[0]({ notification: { extra: { path: '/app/receivables' } } }) })
    assert.equal(view.path(), '/app/receivables')
  } finally { await view.cleanup() }
})

test('로그아웃하면 걸어 둔 알림을 모두 지운다', async () => {
  reset()
  permission = 'granted'
  const view = await mount({ session: GUEST })
  try {
    await waitFor(() => schedules.length > 0)
    const scheduled = pending.length
    await view.setSession(null)
    await waitFor(() => cancels.length > 1)
    assert.equal(cancels[1].length, scheduled)
    assert.equal(pending.length, 0)
  } finally { await view.cleanup() }
})
