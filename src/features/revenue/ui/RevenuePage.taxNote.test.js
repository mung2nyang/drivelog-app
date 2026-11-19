// @ts-check
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/stubSupabaseClient.ts'
import '../../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const reactActEnv = /** @type {{ IS_REACT_ACT_ENVIRONMENT?: boolean }} */ (globalThis)
reactActEnv.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { withSession } = await import('../../../testSupport/withSession.ts')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: RevenuePage } = await import('./RevenuePage.tsx')

const TAX_NOTE = '매출과 정산 금액은 앱에 입력한 기록으로 계산해요. 세무 신고 전 실제 거래 내역과 맞는지 확인해 주세요.'

/** @param {import('../../../data/sync/syncTypes.ts').AppSession|null} session */
async function noteText(session) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await act(async () => { root.render(withSession(React.createElement(RevenuePage, { onOpenMenu: () => {} }), { ownerKey: 'tax-note-test', session })) })
    return container.querySelector('.revenue-tax-note')?.textContent ?? null
  } finally {
    await act(async () => { root.unmount() })
    container.remove()
  }
}

test('차주·개인 기사 매출 화면 맨 아래에 세무 신고 안내 한 줄', async () => {
  assert.equal(await noteText(null), TAX_NOTE)
})

test('직원 기사 매출 화면에는 세무 신고 안내가 없다', async () => {
  assert.equal(await noteText({ accountType: 'employed_driver' }), null)
})
