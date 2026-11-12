import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/stubSupabaseClient.ts'
import '../../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { act } = React
const { createRoot } = await import('react-dom/client')
const { withSession } = await import('../../../testSupport/withSession.ts')
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

/** @param {HTMLInputElement} input @param {string} value */
async function typeInto(input, value) {
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  await act(async () => {
    setValue?.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

test('초대 문자 전체를 붙여넣으면 칸에 코드만 남고, 짧은 입력·코드 없는 글은 그대로', async () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await act(async () => {
      root.render(withSession(React.createElement(InviteRedeemModal, { onClose: () => {}, onLinked: () => {} }), { session: null }))
    })
    const input = /** @type {HTMLInputElement} */ (document.getElementById('driverInviteCode'))
    assert.ok(document.querySelector('.invite-redeem-note')?.textContent?.startsWith('차주에게 받은 초대 코드를 입력하거나, 받은 문자를 통째로 붙여넣어 주세요.'))
    assert.equal(input.placeholder, '초대 코드 또는 받은 문자 전체')
    await typeInto(input, '[운행일지] 안녕하세요, 차주입니다.\n\n▶ 초대 코드 (아래 줄을 길게 눌러 복사하세요)\nA2B3C4D5E6\n\n위 코드를 입력해 주세요.')
    assert.equal(input.value, 'A2B3C4D5E6')
    await typeInto(input, 'a2b3c-4d5e6')
    assert.equal(input.value, 'a2b3c-4d5e6', '코드 길이 안쪽은 친 그대로')
    await typeInto(input, '초대 코드를 아직 못 받았어요')
    assert.equal(input.value, '초대 코드를 아직 못 받았어요', '코드가 없으면 그대로')
  } finally {
    await act(async () => { root.unmount() })
    container.remove()
  }
})
