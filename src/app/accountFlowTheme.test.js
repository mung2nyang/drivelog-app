import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { createFakeSupabase, wait } from '../testSupport/fakeSupabaseClient.ts'

const { fakeSupabase, handlers, emptyOkHandlers } = createFakeSupabase()
fakeSupabase.auth.getSession = async () => ({ data: { session: null }, error: null })
mock.module('../data/cloud/supabaseClient.ts', {
  namedExports: {
    supabase: fakeSupabase,
    getSupabaseAuthErrorMessage: (error) => error?.message || '',
    signInWithGoogle: async () => ({ error: new Error('테스트에서 호출되면 안 됨') }),
    ensureProfileRow: async () => {},
  },
})

Object.assign(handlers, emptyOkHandlers())
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { act } = React
const { createRoot } = await import('react-dom/client')
const { BrowserRouter } = await import('react-router-dom')
const { default: App } = await import('./App.tsx')
const { commitSettings } = await import('../data/store/commitHelpers.ts')
const { normalizeSettings } = await import('../domain/practiceSettings.ts')
const { endCloudSession } = await import('../data/cloud/cloudSession.ts')
const { clearGuestModePersisted } = await import('./guestSessionPersist.ts')

async function waitUntil(predicate, { timeoutMs = 5000, stepMs = 20 } = {}) {
  let ok = false
  await act(async () => {
    const deadline = Date.now() + timeoutMs
    while (!predicate() && Date.now() < deadline) {
      await wait(stepMs)
    }
    ok = predicate()
  })
  if (!ok) throw new Error('waitUntil timeout')
}

/** @param {(container: HTMLElement) => Promise<void>} body */
async function withApp(body) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await act(async () => {
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })
    await body(container)
  } finally {
    await act(async () => { root.unmount() })
    container.remove()
    endCloudSession()
    clearGuestModePersisted()
    commitSettings('guest', normalizeSettings({}))
    document.documentElement.removeAttribute('data-theme')
    localStorage.removeItem('lastTheme')
    Reflect.deleteProperty(window, 'matchMedia')
  }
}

/** 휴대폰 다크 모드 흉내 — set으로 바꾸면 듣는 곳에 알린다. @param {boolean} dark */
function fakePhone(dark) {
  const state = { dark }
  /** @type {Set<() => void>} */
  const listeners = new Set()
  const query = {
    get matches() { return state.dark },
    addEventListener: (/** @type {string} */ _type, /** @type {() => void} */ fn) => { listeners.add(fn) },
    removeEventListener: (/** @type {string} */ _type, /** @type {() => void} */ fn) => { listeners.delete(fn) },
  }
  Object.defineProperty(window, 'matchMedia', { value: () => query, configurable: true, writable: true })
  return {
    /** @param {boolean} next */
    async set(next) {
      state.dark = next
      await act(async () => { listeners.forEach((fn) => fn()) })
    },
  }
}

/** @param {HTMLElement} container */
async function enterAsGuest(container) {
  const guestBtn = container.querySelector('.auth-guest-btn')
  await act(async () => {
    guestBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await waitUntil(() => window.location.pathname === '/app', { timeoutMs: 8000 })
}

test('로그인 화면은 마지막 테마가 다크여도 휴대폰이 라이트면 라이트로 칠하고 그 색을 기억한다', async () => {
  fakePhone(false)
  document.documentElement.setAttribute('data-theme', 'dark')
  localStorage.setItem('lastTheme', 'dark')
  window.history.pushState({}, '', '/auth')
  await withApp(async (container) => {
    await waitUntil(() => !!container.querySelector('.auth-guest-btn'))
    await waitUntil(() => document.documentElement.getAttribute('data-theme') === null)
    assert.equal(localStorage.getItem('lastTheme'), 'light', '로딩 화면 색도 휴대폰 색으로')
    assert.equal(document.body.classList.contains('account-flow-active'), false, '계정 화면 강제 다크 클래스는 없다')
  })
})

test('휴대폰이 다크면 로그인 화면도 다크, 휴대폰 설정이 바뀌면 바로 따라간다', async () => {
  const phone = fakePhone(true)
  localStorage.setItem('lastTheme', 'light')
  window.history.pushState({}, '', '/auth')
  await withApp(async (container) => {
    await waitUntil(() => !!container.querySelector('.auth-guest-btn'))
    await waitUntil(() => document.documentElement.getAttribute('data-theme') === 'dark')
    await phone.set(false)
    await waitUntil(() => document.documentElement.getAttribute('data-theme') === null)
    assert.equal(localStorage.getItem('lastTheme'), 'light')
  })
})

test('휴대폰 설정 따르기(기본)인 계정은 앱 안에서도 휴대폰 색, 휴대폰이 바뀌면 바로 따라간다', async () => {
  const phone = fakePhone(true)
  commitSettings('guest', normalizeSettings({ theme: 'light' }))
  window.history.pushState({}, '', '/auth')
  await withApp(async (container) => {
    await waitUntil(() => !!container.querySelector('.auth-guest-btn'))
    await enterAsGuest(container)
    await waitUntil(() => document.documentElement.getAttribute('data-theme') === 'dark')
    assert.equal(localStorage.getItem('lastTheme'), 'dark', '저장된 테마(라이트)가 아니라 휴대폰 색')
    await phone.set(false)
    await waitUntil(() => document.documentElement.getAttribute('data-theme') === null)
  })
})

test('라이트·다크를 직접 고른 계정은 앱 안에서 고른 색, 휴대폰이 바뀌어도 그대로', async () => {
  const phone = fakePhone(false)
  commitSettings('guest', normalizeSettings({ theme: 'dark', themeFollowPhone: false }))
  window.history.pushState({}, '', '/auth')
  await withApp(async (container) => {
    await waitUntil(() => !!container.querySelector('.auth-guest-btn'))
    assert.equal(document.documentElement.getAttribute('data-theme'), null, '로그인 화면은 휴대폰 색(라이트)')
    await enterAsGuest(container)
    await waitUntil(() => document.documentElement.getAttribute('data-theme') === 'dark')
    await phone.set(true)
    await phone.set(false)
    await act(async () => { await wait(50) })
    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark', '휴대폰이 라이트로 바뀌어도 고른 다크 그대로')
  })
})
