// 앱 설정 "화면 테마" 세 칸(휴대폰 설정·라이트·다크): 눌림 표시, 저장 값, 바로 칠한 색.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/stubSupabaseClient.js'
import '../../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { withSession } = await import('../../../testSupport/withSession.js')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, Route, Routes } = await import('react-router-dom')
const { act } = React
const { default: AppSettingsPage } = await import('./AppSettingsPage.jsx')
const { commitSettings } = await import('../../../data/store/commitHelpers.ts')
const { readOwnerSettings } = await import('../../../data/store/ownerDataHooks.ts')
const { normalizeSettings } = await import('../../../domain/practiceSettings.ts')

/** 휴대폰 다크 모드 흉내. @param {boolean} dark */
function fakePhone(dark) {
  const query = { matches: dark, addEventListener: () => {}, removeEventListener: () => {} }
  Object.defineProperty(window, 'matchMedia', { value: () => query, configurable: true, writable: true })
}

/** @param {string} ownerKey @param {string} path */
async function render(ownerKey, path) {
  commitSettings(ownerKey, normalizeSettings({}))
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const page = withSession(React.createElement(AppSettingsPage, { onBack: () => {} }), { ownerKey })
  await act(async () => {
    root.render(React.createElement(MemoryRouter, { initialEntries: [path] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: '/settings', element: page }),
        React.createElement(Route, { path: '/logs/:logId/settings', element: page }))))
  })
  return {
    container,
    cleanup: async () => {
      await act(async () => { root.unmount() })
      container.remove()
      document.documentElement.removeAttribute('data-theme')
      localStorage.removeItem('lastTheme')
      Reflect.deleteProperty(window, 'matchMedia')
    },
  }
}

/** @param {HTMLElement} container */
function pressedLabels(container) {
  return Array.from(container.querySelectorAll('.settings-theme-row .segment-btn'))
    .filter((btn) => btn.getAttribute('aria-pressed') === 'true' && btn.classList.contains('active'))
    .map((btn) => btn.textContent)
}

/** @param {HTMLElement} container @param {string} id */
async function press(container, id) {
  const btn = container.querySelector(`#${id}`)
  assert.ok(btn instanceof window.HTMLButtonElement, id)
  await act(async () => { btn.click() })
}

test('처음엔 [휴대폰 설정]이 눌려 있고, 라이트·다크·휴대폰 설정을 누르면 저장하고 그 색으로 칠한다', async () => {
  fakePhone(true)
  const ownerKey = 'theme-setting-1'
  const view = await render(ownerKey, '/settings')
  try {
    const labels = Array.from(view.container.querySelectorAll('.settings-theme-row .segment-btn')).map((btn) => btn.textContent)
    assert.deepEqual(labels, ['휴대폰 설정', '라이트', '다크'])
    assert.equal(view.container.querySelector('.settings-theme-row > label')?.textContent, '화면 테마')
    assert.deepEqual(pressedLabels(view.container), ['휴대폰 설정'])

    await press(view.container, 'theme-light')
    assert.equal(readOwnerSettings(ownerKey).themeFollowPhone, false)
    assert.equal(readOwnerSettings(ownerKey).theme, 'light')
    assert.equal(document.documentElement.getAttribute('data-theme'), null, '휴대폰이 다크여도 고른 라이트')
    assert.deepEqual(pressedLabels(view.container), ['라이트'])

    await press(view.container, 'theme-dark')
    assert.equal(readOwnerSettings(ownerKey).themeFollowPhone, false)
    assert.equal(readOwnerSettings(ownerKey).theme, 'dark')
    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
    assert.deepEqual(pressedLabels(view.container), ['다크'])

    await press(view.container, 'theme-light')
    await press(view.container, 'theme-phone')
    assert.equal(readOwnerSettings(ownerKey).themeFollowPhone, true)
    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark', '휴대폰 설정(다크) 색')
    assert.deepEqual(pressedLabels(view.container), ['휴대폰 설정'])
  } finally {
    await view.cleanup()
  }
})

test('비회원도 세 칸이 있고, 기사차량 운행일지 설정에는 없다', async () => {
  const guest = await render('guest', '/settings')
  try {
    assert.equal(guest.container.querySelectorAll('.settings-theme-row .segment-btn').length, 3)
  } finally {
    await guest.cleanup()
  }
  const sub = await render('theme-setting-2', '/logs/11%EA%B0%801111/settings')
  try {
    assert.equal(sub.container.querySelector('#theme-phone'), null)
  } finally {
    await sub.cleanup()
  }
})
