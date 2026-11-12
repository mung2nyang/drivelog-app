import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../testSupport/stubSupabaseClient.ts'
import '../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { setHydration } = await import('../../data/store/app-store.ts')
const { default: HydrationRetryBanner } = await import('./HydrationRetryBanner.jsx')

/** @returns {Promise<string|null>} */
async function bannerText() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => { root.render(React.createElement(HydrationRetryBanner)) })
  const text = container.querySelector('[role="alert"] span')?.textContent ?? null
  await act(async () => { root.unmount() })
  container.remove()
  return text
}

test('불러오기 실패면 "기록이 빠져 있을 수 있다" 안내, 휴대폰 기록으로 계속 쓴다는 말은 없음', async () => {
  setHydration({ status: 'failed', userId: 'user-1', ownerKey: 'owner-1' })
  const text = await bannerText()
  assert.equal(text, '서버에서 기록을 불러오지 못했습니다. 지금 보이는 기록은 빠져 있을 수 있으니 [다시 시도]를 눌러 주세요.')
  assert.equal(text?.includes('휴대폰'), false)
})

test('불러오기 실패가 아니면 띠 없음', async () => {
  setHydration({ status: 'ready', userId: 'user-1', ownerKey: 'owner-1' })
  assert.equal(await bannerText(), null)
})
