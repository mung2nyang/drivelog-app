// 기사 초대 코드 창 — 설명 옆 (i)를 누르면 연동하면 바뀌는 것이 펼쳐진다.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/stubSupabaseClient.js'
import '../../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { act } = React
const { createRoot } = await import('react-dom/client')
const { withSession } = await import('../../../testSupport/withSession.js')
const { default: InviteRedeemModal } = await import('./InviteRedeemModal.jsx')

test('설명 옆 (i)를 누르면 배정 차량, 사업자 정보, 설정, 해제 안내가 펼쳐진다', async () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await act(async () => {
      root.render(withSession(React.createElement(InviteRedeemModal, { onClose: () => {}, onLinked: () => {} }), { session: null }))
    })
    const button = document.querySelector('.invite-redeem-note button[aria-label="연동하면 바뀌는 것 설명 보기"]')
    assert.ok(button)
    await act(async () => { button.click() })
    const text = document.querySelector('.invite-redeem-note .summary-info-text')?.textContent ?? ''
    assert.ok(text.startsWith('일지는 차주님이 배정한 차량으로 기록되고, 계약기간 안 날짜만 기록할 수 있습니다.'))
    assert.ok(text.includes('사업자 정보와 정산 계좌는 차주님이 입력한 값이 보이고, 고칠 수 없습니다.'))
    assert.ok(text.includes('앱 설정은 기사님 것 그대로입니다.'))
    assert.ok(text.includes('차주님이 동의하거나 3일이 지나면 해제됩니다. 연동 중에는 탈퇴할 수 없습니다.'))
  } finally {
    await act(async () => { root.unmount() })
    container.remove()
  }
})
