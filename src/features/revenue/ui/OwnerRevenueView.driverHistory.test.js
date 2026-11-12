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
const { default: OwnerRevenueView } = await import('./OwnerRevenueView.jsx')
const { commitCars, commitLogWorkData } = await import('../../../data/store/commitHelpers.ts')
const { replaceOwnerState } = await import('../../../data/store/owner-state.ts')

/** @param {HTMLElement} container @param {string} text */
function clickButton(container, text) {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === text)
  assert.ok(button, `${text} 버튼이 있어야 한다`)
  button.click()
}

test('매출 화면을 연 뒤 해제 기록이 들어오면 기사 급여에 이전 기사 줄이 보인다', async () => {
  const ownerKey = 'revenue-driver-history'
  const now = new Date()
  const month = now.getMonth() + 1
  const ym = `${now.getFullYear()}-${String(month).padStart(2, '0')}`
  commitCars(ownerKey, [
    { id: 'c-main', type: 'main', number: '11가1111' },
    { id: 'c-sub', type: 'sub', number: '22가2222', driverName: '테스트2', driverPayMode: 'revenue', commEnabled: true, commType: 'percent', commission: '20' },
  ])
  commitLogWorkData(ownerKey, '22가2222', {
    [`${ym}-05`]: { callDetails: [{ id: 'a', client: 'A', fare: 400000 }] },
    [`${ym}-12`]: { callDetails: [{ id: 'b', client: 'A', fare: 300000 }] },
  })

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await act(async () => { root.render(withSession(React.createElement(OwnerRevenueView, {}), { ownerKey })) })
    await act(async () => { clickButton(container, '기사') })
    const head = [...container.querySelectorAll('.revenue-detail-head')].find((item) => item.textContent?.includes('기사 급여'))
    assert.ok(head instanceof window.HTMLButtonElement, '기사 급여 줄이 있어야 한다')
    await act(async () => { head.click() })
    assert.equal((container.textContent || '').includes('이전 기사'), false, '해제 기록 전에는 이전 기사 줄이 없다')

    await act(async () => {
      replaceOwnerState(ownerKey, { driverHistory: [{ id: 'h1', vehicleNumber: '22가2222', assignmentStart: `${ym}-01`, assignmentEnd: `${ym}-10`, status: 'disconnected' }] }, { persist: false })
    })
    const lines = [...container.querySelectorAll('.revenue-detail-line')].map((item) => item.textContent)
    assert.ok(lines.includes(`이전 기사 (${month}/1~${month}/10)-80,000원`), `이전 기사 줄이 보여야 한다: ${lines.join(' | ')}`)
    assert.ok(lines.includes('테스트2-60,000원'), `나머지 날은 차량 기사 이름 줄: ${lines.join(' | ')}`)
  } finally {
    await act(async () => { root.unmount() })
    container.remove()
  }
})
