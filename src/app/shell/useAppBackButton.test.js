// 앱(Capacitor C-5) 뒤로가기 — 앞 기록이 있으면 크롬처럼 뒤로, 없으면 앱 닫기. 앱도 설치 앱으로 봐서 홈 종료 안내·당겨 새로고침이 켜짐.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../testSupport/stubSupabaseClient.js'
import '../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

let native = true
/** @type {Array<(event: { canGoBack: boolean }) => void>} */
const listeners = []
let exits = 0
let removes = 0

mock.module('@capacitor/core', { namedExports: { Capacitor: { isNativePlatform: () => native } } })
mock.module('@capacitor/app', {
  namedExports: {
    App: {
      addListener: async (/** @type {string} */ name, /** @type {(event: { canGoBack: boolean }) => void} */ listener) => {
        assert.equal(name, 'backButton')
        listeners.push(listener)
        return { remove: async () => { removes += 1; listeners.splice(listeners.indexOf(listener), 1) } }
      },
      exitApp: async () => { exits += 1 },
    },
  },
})

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { BrowserRouter } = await import('react-router-dom')
const { withToast } = await import('../../testSupport/withToast.js')
const { default: useAppBackButton } = await import('./useAppBackButton.js')
const { default: useBackToExit } = await import('./useBackToExit.js')
const { default: usePullToRefresh } = await import('./usePullToRefresh.js')

const flush = () => new Promise((resolve) => { setTimeout(resolve, 0) })

/** 플러그인을 그때 불러와서 느린 컴퓨터에서는 한 번 기다려서는 모자란다 — 조건이 맞을 때까지 최대 50번. @param {() => boolean} check */
async function waitFor(check) {
  for (let i = 0; i < 50 && !check(); i += 1) await act(async () => { await flush() })
}

function reset() {
  native = true
  listeners.length = 0
  exits = 0
  removes = 0
  Reflect.set(window, 'matchMedia', () => ({ matches: false }))
}

/** @param {() => void} useHook */
async function mount(useHook) {
  function Probe() {
    useHook()
    return null
  }
  const root = createRoot(document.createElement('div'))
  await act(async () => { root.render(withToast(React.createElement(BrowserRouter, null, React.createElement(Probe)), () => {})) })
  return async () => { await act(async () => { root.unmount() }) }
}

test('앱: 뒤로가기는 앞 기록이 있으면 history.back, 없으면 앱 닫기, 화면이 사라지면 듣기를 뗀다', async () => {
  reset()
  let backs = 0
  const spy = mock.method(window.history, 'back', () => { backs += 1 })
  const unmount = await mount(useAppBackButton)
  try {
    await waitFor(() => listeners.length === 1)
    assert.equal(listeners.length, 1)
    listeners[0]({ canGoBack: true })
    assert.equal(backs, 1)
    assert.equal(exits, 0)
    listeners[0]({ canGoBack: false })
    assert.equal(backs, 1)
    assert.equal(exits, 1)
  } finally {
    await unmount()
    spy.mock.restore()
  }
  await waitFor(() => removes === 1)
  assert.equal(removes, 1)
  assert.equal(listeners.length, 0)
})

test('웹: 뒤로가기를 가로채지 않는다', async () => {
  reset()
  native = false
  const unmount = await mount(useAppBackButton)
  await waitFor(() => listeners.length > 0)
  assert.equal(listeners.length, 0)
  await unmount()
})

test('앱: 화면 모드가 browser여도 설치 앱으로 봐서 홈에 붙잡기 기록을 쌓는다(웹 탭은 안 쌓음)', async () => {
  for (const app of [true, false]) {
    reset()
    native = app
    window.history.replaceState(null, '', '/app')
    const unmount = await mount(() => useBackToExit(60))
    const idx = Reflect.get(window.history.state || {}, 'idx')
    await unmount()
    assert.equal(idx, app ? 1 : 0, app ? '앱' : '웹 탭')
  }
})

test('앱: 화면 모드가 browser여도 당겨 새로고침이 켜진다(웹 탭은 꺼짐)', async () => {
  for (const app of [true, false]) {
    reset()
    native = app
    const spy = mock.method(window, 'addEventListener')
    const unmount = await mount(() => { usePullToRefresh() })
    const added = spy.mock.calls.map((call) => call.arguments[0])
    spy.mock.restore()
    await unmount()
    assert.equal(added.includes('touchstart'), app, app ? '앱' : '웹 탭')
  }
})
