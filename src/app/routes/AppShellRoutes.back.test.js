// 고객센터·관리자 ← 는 연 곳으로 — 마이페이지에서 열면 마이페이지, 옆 메뉴(홈)에서 열면 홈.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../testSupport/stubSupabaseClient.js'
import '../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')

/** @param {{ onBack?: () => void }} props */
function FakePage({ onBack }) {
  return React.createElement('button', { type: 'button', className: 'fake-back', onClick: onBack }, '←')
}
const PAGE_NAMES = [
  'AppSettingsPage', 'CarManagementPage', 'ClientManagementPage', 'DriverConnectionPage', 'LinkedDriverClientsPage',
  'LinkedDriverManagementPage', 'MaintFuelPage', 'MyPage', 'OwnerScopedClientsView', 'PersonalInfoPage', 'ReceivablesPage',
  'DocumentIssuePage', 'RevenuePage', 'ComingSoonPage', 'CustomerCenterPage', 'AdminInquiriesPage', 'NoticePage', 'MessageSettingsPage', 'NotificationsPage',
]
mock.module('./lazyPages.js', { namedExports: Object.fromEntries(PAGE_NAMES.map((name) => [name, FakePage])) })

const { withSession } = await import('../../testSupport/withSession.js')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, Route, Routes } = await import('react-router-dom')
const { act } = React
const { default: AppShellRoutes } = await import('./AppShellRoutes.jsx')

/** @param {string} url @returns {Promise<string[]>} ← 를 눌렀을 때 goBack에 넘어간 곳 */
async function pressBack(url) {
  /** @type {string[]} */
  const targets = []
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const routes = React.createElement(AppShellRoutes, {
    notifCount: 0, onOpenMenu: () => {}, onOpenNotifs: () => {}, navigate: () => {},
    goBack: (/** @type {string} */ target) => { targets.push(target) }, goToPage: () => {},
  })
  await act(async () => {
    root.render(withSession(React.createElement(
      MemoryRouter,
      { initialEntries: [url] },
      React.createElement(Routes, null, React.createElement(Route, { path: '/app/*', element: routes })),
    ), { ownerKey: 'test-back' }))
  })
  const back = container.querySelector('.fake-back')
  assert.ok(back instanceof window.HTMLButtonElement, `${url} 화면`)
  await act(async () => { back.click() })
  await act(async () => { root.unmount() })
  container.remove()
  return targets
}

test('고객센터: 마이페이지에서 열면 ← 마이페이지, 옆 메뉴에서 열면 ← 홈', async () => {
  assert.deepEqual(await pressBack('/app/support?back=mypage'), ['/app/me'])
  assert.deepEqual(await pressBack('/app/support?back=home'), ['/app'])
})

test('관리자: 마이페이지에서 열면 ← 마이페이지, 옆 메뉴에서 열면 ← 홈', async () => {
  assert.deepEqual(await pressBack('/app/admin/inquiries?back=mypage'), ['/app/me'])
  assert.deepEqual(await pressBack('/app/admin/inquiries?back=home'), ['/app'])
})
