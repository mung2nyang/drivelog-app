import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

import '../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { createFakeSupabase } from '../testSupport/fakeSupabaseClient.ts'

const { fakeSupabase, handlers, resetHandlers, emptyOkHandlers } = createFakeSupabase()
fakeSupabase.auth.getSession = async () => ({ data: { session: null }, error: null })
mock.module('../data/cloud/supabaseClient.ts', {
  namedExports: {
    supabase: fakeSupabase,
    getSupabaseAuthErrorMessage: (/** @type {{ message?: string }|null} */ error) => error?.message || '',
    signInWithGoogle: async () => ({ error: new Error('테스트에서 호출되면 안 됨') }),
    ensureProfileRow: async () => {},
  },
})
mock.module('../shared/utils/assetPath.ts', {
  namedExports: {
    assetPath: () => ({ [Symbol.toPrimitive]() { throw new Error('로그인 화면 오류(시험)') } }),
  },
})
resetHandlers()
Object.assign(handlers, emptyOkHandlers())
register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { act } = React
const { createRoot } = await import('react-dom/client')
const { BrowserRouter } = await import('react-router-dom')
const { default: App } = await import('./App.jsx')

test('로그인 화면이 그리다 오류를 내면 빈 화면 대신 안내와 [다시 시도]가 보인다', async () => {
  window.history.pushState({}, '', '/auth')
  const errors = mock.method(console, 'error', () => {})
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await act(async () => {
      root.render(React.createElement(BrowserRouter, null, React.createElement(App)))
    })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)) })
    const text = container.textContent || ''
    assert.ok(text.includes('화면을 불러오지 못했습니다.'), text.slice(0, 200))
    const retry = Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent === '다시 시도')
    assert.ok(retry, '[다시 시도] 버튼이 있다')
  } finally {
    await act(async () => { root.unmount() })
    container.remove()
    errors.mock.restore()
  }
})
