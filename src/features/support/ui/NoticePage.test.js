// 공지사항: 공지가 제목(날짜)로 보이고, 누르면 본문이 펼쳐진다.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: NoticePage } = await import('./NoticePage.jsx')

test('운비서 하루 이용 횟수 공지가 제목(날짜)로 보이고, 누르면 본문(20번·리셋)이 펼쳐진다', async () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => { root.render(React.createElement(NoticePage)) })
  try {
    const items = container.querySelectorAll('.notice-page .faq-item')
    assert.equal(items.length, 1)
    assert.equal(container.querySelector('.notice-page .empty-state'), null)
    assert.equal(items[0].querySelector('span')?.textContent, '운비서 하루 이용 횟수 안내 (2026.11.04)')
    assert.ok(!items[0].classList.contains('open'))
    await act(async () => { /** @type {HTMLElement} */ (items[0]).click() })
    assert.ok(items[0].classList.contains('open'))
    assert.equal(items[0].querySelector('.support-detail')?.textContent, 'AI 운비서는 계정마다 하루 20번까지 쓸 수 있습니다. 횟수는 매일 밤 12시(한국 시각)\u2060에 리셋 됩니다.')
  } finally {
    await act(async () => { root.unmount() })
    container.remove()
  }
})
