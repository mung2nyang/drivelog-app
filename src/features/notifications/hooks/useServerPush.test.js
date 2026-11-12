// @ts-check
// 서버 알림 받을 주소 — 웹·옛 앱·비회원은 안 함, 허용됐으면 주소를 받아 지금 계정으로 맡김, 허용 전이면 안 묻고 기다림, 계정 바뀌면 다시, 로그아웃이면 휴대폰 주소 지움, 누르면 그 화면.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/stubSupabaseClient.ts'
import '../../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

let native = true
let pluginAvailable = true
let receive = 'granted'
let token = 'token-1'
let registers = 0
let unregisters = 0
let permissionRequests = 0
/** @type {Map<string, Array<(event: object) => void>>} */
const listeners = new Map()
/** @type {Array<string>} */
const saved = []
/** @type {Array<() => void>} */
const resumes = []

mock.module('@capacitor/core', {
  namedExports: { Capacitor: { isNativePlatform: () => native, isPluginAvailable: (/** @type {string} */ name) => name === 'PushNotifications' && pluginAvailable } },
})
mock.module('@capacitor/app', {
  namedExports: { App: { addListener: async (/** @type {string} */ _name, /** @type {() => void} */ listener) => { resumes.push(listener); return { remove: async () => {} } } } },
})
mock.module('../../../data/cloud/pushDevices.ts', {
  namedExports: { registerPushDevice: async (/** @type {string} */ value) => { saved.push(value) } },
})
// 진짜 플러그인처럼 모르는 이름(then 포함)은 휴대폰 기능 부르기로 바뀌어 실패한다.
const plugin = {
  checkPermissions: async () => ({ receive }),
  requestPermissions: async () => { permissionRequests += 1; return { receive } },
  register: async () => {
    registers += 1
    ;(listeners.get('registration') || []).forEach((listener) => listener({ value: token }))
  },
  unregister: async () => { unregisters += 1 },
  addListener: async (/** @type {string} */ name, /** @type {(event: object) => void} */ listener) => {
    listeners.set(name, [...(listeners.get(name) || []), listener])
    return { remove: async () => { listeners.set(name, (listeners.get(name) || []).filter((l) => l !== listener)) } }
  },
}
const pluginProxy = new Proxy(plugin, {
  get: (target, name) => (name in target ? Reflect.get(target, name) : () => Promise.reject(new Error(`"PushNotifications.${String(name)}()" is not implemented on android`))),
})
mock.module('@capacitor/push-notifications', { namedExports: { PushNotifications: pluginProxy } })

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { MemoryRouter, useLocation } = await import('react-router-dom')
const { default: useServerPush } = await import('./useServerPush.ts')

const A = { userId: 'user-a', name: 'A' }
const B = { userId: 'user-b', name: 'B' }
const GUEST = { guestMode: true, name: '비회원' }
const flush = () => new Promise((resolve) => { setTimeout(resolve, 5) })

/** @param {() => boolean} check */
async function waitFor(check) {
  for (let i = 0; i < 60 && !check(); i += 1) await act(async () => { await flush() })
}
const settle = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await flush() }) }

function reset() {
  native = true
  pluginAvailable = true
  receive = 'granted'
  token = 'token-1'
  registers = 0
  unregisters = 0
  permissionRequests = 0
  listeners.clear()
  saved.length = 0
  resumes.length = 0
}

/** @param {object|null} initial */
async function mount(initial) {
  /** @type {(session: object|null) => void} */
  let setSession = () => {}
  let path = ''
  function Probe() {
    const [session, setSessionState] = React.useState(initial)
    setSession = setSessionState
    path = useLocation().pathname
    useServerPush(/** @type {import('../../../data/sync/syncTypes.ts').AppSession|null} */ (session), false)
    return null
  }
  const root = createRoot(document.createElement('div'))
  await act(async () => { root.render(React.createElement(MemoryRouter, { initialEntries: ['/app'] }, React.createElement(Probe))) })
  return {
    path: () => path,
    setSession: async (/** @type {object|null} */ next) => { await act(async () => { setSession(next) }) },
    cleanup: async () => { await act(async () => { root.unmount() }) },
  }
}

test('웹·푸시 장치 없는 옛 앱·비회원은 아무것도 안 한다', async () => {
  for (const [isNative, available, session] of [[false, true, A], [true, false, A], [true, true, GUEST]]) {
    reset()
    native = Boolean(isNative)
    pluginAvailable = Boolean(available)
    const view = await mount(/** @type {object} */ (session))
    try {
      await settle()
      assert.equal(registers + unregisters + permissionRequests, 0)
      assert.deepEqual(saved, [])
    } finally { await view.cleanup() }
  }
})

test('알림이 허용돼 있으면 주소를 받아 지금 계정으로 맡긴다', async () => {
  reset()
  const view = await mount(A)
  try {
    await waitFor(() => saved.length > 0)
    assert.equal(registers, 1)
    assert.deepEqual(saved, ['token-1'])
    assert.equal(permissionRequests, 0, '허용은 여기서 묻지 않음')
  } finally { await view.cleanup() }
})

test('허용 전이면 기다렸다가, 허용 창을 닫고 돌아오면 맡긴다', async () => {
  reset()
  receive = 'prompt'
  const view = await mount(A)
  try {
    await settle()
    assert.equal(registers, 0)
    receive = 'granted'
    await act(async () => { resumes.forEach((resume) => resume()) })
    await waitFor(() => saved.length > 0)
    assert.deepEqual(saved, ['token-1'])
  } finally { await view.cleanup() }
})

test('계정을 바꾸면 다시 맡기고, 로그아웃하면 휴대폰 주소를 지운다', async () => {
  reset()
  const view = await mount(A)
  try {
    await waitFor(() => saved.length > 0)
    await view.setSession(B)
    await waitFor(() => saved.length > 1)
    assert.equal(registers, 2)
    await view.setSession(null)
    await waitFor(() => unregisters > 0)
    assert.equal(unregisters, 1)
    assert.equal(saved.length, 2, '로그아웃 뒤엔 맡기지 않음')
  } finally { await view.cleanup() }
})

test('서버 알림을 누르면 그 화면으로, /app 밖 주소는 무시', async () => {
  reset()
  const view = await mount(A)
  try {
    await waitFor(() => (listeners.get('pushNotificationActionPerformed') || []).length > 0)
    const tap = (/** @type {object} */ data) => (listeners.get('pushNotificationActionPerformed') || []).forEach((l) => l({ notification: { data } }))
    await act(async () => { tap({ path: 'https://evil.example' }) })
    assert.equal(view.path(), '/app')
    await act(async () => { tap({ path: '/app/support' }) })
    assert.equal(view.path(), '/app/support')
  } finally { await view.cleanup() }
})
