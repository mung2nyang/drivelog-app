import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { createFakeSupabase } from '../testSupport/fakeSupabaseClient.ts'

const { fakeSupabase, handlers, resetHandlers, emptyOkHandlers } = createFakeSupabase()
Object.assign(fakeSupabase.auth, { getSession: async () => ({ data: { session: null }, error: null }) })
mock.module('../data/cloud/supabaseClient.ts', {
  namedExports: {
    supabase: fakeSupabase,
    getSupabaseAuthErrorMessage: (/** @type {{ message?: string }} */ error) => error?.message || '',
    signInWithGoogle: async () => ({ error: new Error('테스트에서 호출되면 안 됨') }),
    ensureProfileRow: async () => {},
  },
})
resetHandlers()
Object.assign(handlers, emptyOkHandlers())

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { act } = React
const { createRoot } = await import('react-dom/client')
const { BrowserRouter } = await import('react-router-dom')
const { default: App } = await import('./App.tsx')
const { storageKeyFor } = await import('../data/store/persist.ts')

const CARS = JSON.stringify([{ id: 'c-main', type: 'main', number: '12가3456' }])
const EXPENSES = JSON.stringify([{ id: 'e-1', kind: 'maint', date: '2026-10-09', cost: 1000 }])

/** @param {{ records: boolean }} setup */
function seedGuest({ records }) {
  localStorage.clear()
  localStorage.setItem('reactPracticeGuestMode', '1')
  localStorage.setItem(storageKeyFor('cars', 'guest'), CARS)
  if (records) localStorage.setItem(storageKeyFor('expenses', 'guest'), EXPENSES)
}

/** @param {() => boolean} ok */
async function waitUntil(ok, limitMs = 3000) {
  const end = Date.now() + limitMs
  while (!ok() && Date.now() < end) {
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 20) }) })
  }
}

async function openProfile() {
  window.history.pushState({}, '', '/app/me/profile')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => { root.render(React.createElement(BrowserRouter, null, React.createElement(App))) })
  /** @param {string} label */
  const find = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent === label)
  await waitUntil(() => !!find('로그인하기'))
  return {
    container,
    modalOpen: () => !!container.textContent?.includes('비회원 기록 옮기기'),
    /** @param {string} label */
    async press(label) { await act(async () => { find(label)?.click() }) },
    cleanup: async () => { await act(async () => { root.unmount() }); container.remove() },
  }
}

test('기록 있는 비회원이 [로그인하기]를 누르면 로그인 화면 대신 안내 창, [취소]면 그 화면에 머묾', async () => {
  seedGuest({ records: true })
  const view = await openProfile()
  try {
    await view.press('로그인하기')
    assert.ok(view.modalOpen(), '안내 창이 떠야 한다')
    assert.equal(window.location.pathname, '/app/me/profile')
    await view.press('취소')
    assert.equal(view.modalOpen(), false)
    assert.equal(window.location.pathname, '/app/me/profile')
    assert.equal(localStorage.getItem('reactPracticeGuestMode'), '1', '비회원 그대로')
  } finally { await view.cleanup() }
})

test('[그냥 로그인]은 로그인 화면으로, 비회원 기록은 지우지 않는다', async () => {
  seedGuest({ records: true })
  const view = await openProfile()
  try {
    await view.press('로그인하기')
    await view.press('그냥 로그인')
    await waitUntil(() => window.location.pathname === '/auth')
    assert.equal(window.location.pathname, '/auth')
    assert.equal(localStorage.getItem(storageKeyFor('expenses', 'guest')), EXPENSES, '비회원 지출 그대로')
  } finally { await view.cleanup() }
})

test('기록 없는 비회원은 창 없이 바로 로그인 화면', async () => {
  seedGuest({ records: false })
  const view = await openProfile()
  try {
    await view.press('로그인하기')
    await waitUntil(() => window.location.pathname === '/auth')
    assert.equal(window.location.pathname, '/auth')
    assert.equal(view.modalOpen(), false)
  } finally { await view.cleanup() }
})
