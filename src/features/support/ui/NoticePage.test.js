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
const { default: NoticePage } = await import('./NoticePage.tsx')

test('공지 2개: 맨 위 기사 연동 해제 안내, 그다음 운비서 하루 이용 횟수, 누르면 본문이 펼쳐진다', async () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => { root.render(React.createElement(NoticePage)) })
  try {
    const items = container.querySelectorAll('.notice-page .faq-item')
    assert.equal(items.length, 2)
    assert.equal(container.querySelector('.notice-page .empty-state'), null)
    assert.equal(items[0].querySelector('span')?.textContent, '기사 연동 해제 안내 (2026.11.18)')
    assert.equal(items[1].querySelector('span')?.textContent, '운비서 하루 이용 횟수 안내 (2026.11.04)')
    assert.ok(!items[0].classList.contains('open'))
    await act(async () => { /** @type {HTMLElement} */ (items[0]).click() })
    assert.ok(items[0].classList.contains('open'))
    assert.equal(items[0].querySelector('.support-detail')?.textContent, '연동을 해제하면 연동 기간의 운행 기록과 거래처 정보(상호, 담당자, 사업자번호, 전화번호)가 기사 계정으로 복사됩니다. 11월 25일부터 개인정보처리방침과 이용약관에도 해당 내용을 반영합니다.')
    await act(async () => { /** @type {HTMLElement} */ (items[1]).click() })
    assert.ok(items[1].classList.contains('open'))
    assert.equal(items[1].querySelector('.support-detail')?.textContent, 'AI 운비서는 계정마다 하루 20번까지 쓸 수 있습니다. 횟수는 매일 밤 12시(한국 시각)\u2060에 리셋 됩니다.')
  } finally {
    await act(async () => { root.unmount() })
    container.remove()
  }
})
