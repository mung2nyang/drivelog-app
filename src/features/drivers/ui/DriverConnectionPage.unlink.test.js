import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/stubSupabaseClient.ts'
import '../../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { withSession } = await import('../../../testSupport/withSession.ts')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: DriverConnectionPage } = await import('./DriverConnectionPage.tsx')
const { commitDrivers } = await import('../../../data/store/commitHelpers.ts')
const { beginSessionEpoch, endCloudSession } = await import('../../../data/cloud/cloudSession.ts')

/** @param {Element} card */
function buttons(card) {
  return [...card.querySelectorAll('button')].map((el) => el.textContent?.trim())
}

test('연동 중 카드 세 가지 상태: [해제 요청] / 요청 중·[요청 취소] / 기사 요청·[동의], 거절 없음', async () => {
  const ownerKey = 'owner-7c-page'
  beginSessionEpoch(ownerKey, ownerKey)
  const requestedAt = '2026-10-01T03:00:00.000Z'
  commitDrivers(ownerKey, [
    { id: 'd-none', name: '요청없음기사', status: 'linked', vehicleNumber: '11가1111', supabaseId: 'l1' },
    { id: 'd-mine', name: '내요청기사', status: 'linked', vehicleNumber: '22가2222', supabaseId: 'l2', unlinkRequestedBy: ownerKey, unlinkRequestedAt: requestedAt },
    { id: 'd-theirs', name: '기사요청기사', status: 'linked', vehicleNumber: '33가3333', supabaseId: 'l3', unlinkRequestedBy: 'driver-x', unlinkRequestedAt: requestedAt },
  ])

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await act(async () => {
      root.render(withSession(React.createElement(DriverConnectionPage, { onBack: () => {} }), { ownerKey, session: { userId: ownerKey, name: '차주', phone: '' } }))
    })
    const cards = [...container.querySelectorAll('.driver-connection-card')]
    const byName = (/** @type {string} */ name) => cards.find((card) => card.textContent?.includes(name))
    const none = byName('요청없음기사')
    const mine = byName('내요청기사')
    const theirs = byName('기사요청기사')
    assert.ok(none && mine && theirs)

    assert.ok(buttons(none).includes('해제 요청'))
    assert.equal(buttons(none).includes('연동 해제'), false, '바로 끊는 버튼은 없어야 한다')

    assert.ok(mine.textContent?.includes('해제 요청 중 — 기사 동의 대기 (10월 4일에 자동으로 연동 해제)'))
    assert.ok(buttons(mine).includes('요청 취소'))
    assert.equal(buttons(mine).includes('해제 요청'), false)

    assert.ok(theirs.textContent?.includes('기사가 해제를 요청했습니다 (10월 4일에 자동으로 연동 해제)'))
    assert.ok(buttons(theirs).includes('동의'))
    assert.equal(buttons(theirs).some((label) => label?.includes('거절')), false, '거절 버튼은 없다')
  } finally {
    await act(async () => { root.unmount() })
    container.remove()
    endCloudSession()
  }
})

test('차주 [해제 요청]·[동의] 확인 창: 기사 계정으로 복사 안내, 취소하면 그대로', async () => {
  const ownerKey = 'owner-unlink-confirm'
  beginSessionEpoch(ownerKey, ownerKey)
  commitDrivers(ownerKey, [
    { id: 'd-none', name: '요청없음기사', status: 'linked', vehicleNumber: '11가1111', supabaseId: 'l1' },
    { id: 'd-theirs', name: '기사요청기사', status: 'linked', vehicleNumber: '33가3333', supabaseId: 'l3', unlinkRequestedBy: 'driver-x', unlinkRequestedAt: '2026-10-01T03:00:00.000Z' },
  ])
  /** @type {Array<string>} */
  const confirms = []
  window.confirm = (/** @type {string} */ message) => { confirms.push(message); return false }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await act(async () => {
      root.render(withSession(React.createElement(DriverConnectionPage, { onBack: () => {} }), { ownerKey, session: { userId: ownerKey, name: '차주', phone: '' } }))
    })
    const cards = [...container.querySelectorAll('.driver-connection-card')]
    const byName = (/** @type {string} */ name) => cards.find((card) => card.textContent?.includes(name))
    const press = async (/** @type {string} */ name, /** @type {string} */ label) => {
      const button = [...(byName(name)?.querySelectorAll('button') || [])].find((el) => el.textContent?.trim() === label)
      assert.ok(button instanceof window.HTMLButtonElement, `${label} 버튼이 있어야 한다`)
      await act(async () => { button.click() })
    }
    await press('요청없음기사', '해제 요청')
    await press('기사요청기사', '동의')
    assert.deepEqual(confirms, [
      '기사 연동 해제\n기사가 동의하거나 3일이 지나면 해제돼요. 해제 시 연동 기간의 운행 기록과 거래처 정보(상호, 담당자, 사업자번호, 전화번호)가 기사 계정으로 복사돼요.',
      '연동 해제\n동의하면 바로 해제되며 되돌릴 수 없어요. 연동 기간의 운행 기록과 거래처 정보(상호, 담당자, 사업자번호, 전화번호)가 기사 계정으로 복사돼요.',
    ])
    assert.ok(buttons(/** @type {Element} */ (byName('요청없음기사'))).includes('해제 요청'))
    assert.ok(buttons(/** @type {Element} */ (byName('기사요청기사'))).includes('동의'))
  } finally {
    await act(async () => { root.unmount() })
    container.remove()
    endCloudSession()
  }
})
