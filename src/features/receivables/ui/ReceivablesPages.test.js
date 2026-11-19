import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/stubSupabaseClient.ts'
import '../../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { withSession } = await import('../../../testSupport/withSession.ts')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, Route, Routes } = await import('react-router-dom')
const { act } = React
const { default: ReceivablesPage } = await import('./ReceivablesPage.tsx')
const { commitCars, commitSettings, commitWorkData } = await import('../../../data/store/commitHelpers.ts')
const { normalizeSettings } = await import('../../../domain/practiceSettings.ts')

/**
 * @param {string} ownerKey
 * @param {string} path
 * @param {boolean} isEmployedDriver
 */
async function renderAt(ownerKey, path, isEmployedDriver) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(
      MemoryRouter,
      { initialEntries: [path] },
      React.createElement(Routes, null, React.createElement(Route, {
        path: '/app/receivables/*',
        element: withSession(React.createElement(ReceivablesPage, { isEmployedDriver }), { ownerKey }),
      })),
    ))
  })
  return {
    container,
    /** @returns {string[]} */
    badges: () => Array.from(container.querySelectorAll('.management-badge.car-type')).map((el) => el.textContent || ''),
    async cleanup() {
      await act(async () => { root.unmount() })
      container.remove()
    },
  }
}

/** @param {string} ownerKey @param {Array<object>} cars @param {boolean} [paymentOn] */
function seed(ownerKey, cars, paymentOn = true) {
  commitSettings(ownerKey, normalizeSettings({ paymentOn }))
  commitCars(ownerKey, cars)
  commitWorkData(ownerKey, {
    '2026-09-03': { isOff: false, callDetails: [{ id: 'u1', client: 'A', fare: 100000, payments: [] }] },
  })
}

test('차주(기사 차량 있음): 목록·상세에 "메인 차량" 배지 그대로', async () => {
  const ownerKey = 'test-recv-owner'
  seed(ownerKey, [
    { id: 'c-main', type: 'main', number: '12가3456' },
    { id: 'c-sub', type: 'sub', number: '34나5678' },
  ])
  const list = await renderAt(ownerKey, '/app/receivables', false)
  try {
    assert.ok(list.badges().includes('메인 차량'), list.badges().join(','))
  } finally {
    await list.cleanup()
  }
  const detail = await renderAt(ownerKey, '/app/receivables/A/2026-09', false)
  try {
    assert.ok(detail.badges().includes('메인 차량'), detail.badges().join(','))
  } finally {
    await detail.cleanup()
  }
})

test('연동 기사 계정: 자기 차가 "메인 차량"으로 안 보이게 목록·상세 차량 배지 없음', async () => {
  const ownerKey = 'test-recv-driver'
  seed(ownerKey, [{ id: 'c-assigned', type: 'sub', number: '11가1111' }])
  const list = await renderAt(ownerKey, '/app/receivables', true)
  try {
    assert.ok((list.container.textContent || '').includes('A'), '미수 건은 그대로 보여야 한다')
    assert.deepEqual(list.badges(), [])
  } finally {
    await list.cleanup()
  }
  const detail = await renderAt(ownerKey, '/app/receivables/A/2026-09', true)
  try {
    assert.ok((detail.container.textContent || '').includes('100,000원'))
    assert.deepEqual(detail.badges(), [])
  } finally {
    await detail.cleanup()
  }
})

test('결제/수금을 끄면 목록 대신 꺼져 있다는 안내, 다시 켜면 미수 건 그대로', async () => {
  const ownerKey = 'test-recv-payment-off'
  seed(ownerKey, [{ id: 'c-main', type: 'main', number: '12가3456' }], false)
  const off = await renderAt(ownerKey, '/app/receivables', false)
  try {
    const text = off.container.textContent || ''
    assert.ok(text.includes('결제/수금 관리가 꺼져 있어요. 앱 설정에서 켜면 미수금을 볼 수 있어요.'), text.slice(0, 300))
    assert.equal(off.container.querySelector('.receivable-group-card'), null)
    assert.equal(off.container.querySelector('.receivable-tabs'), null)
  } finally {
    await off.cleanup()
  }
  commitSettings(ownerKey, normalizeSettings({ paymentOn: true }))
  const on = await renderAt(ownerKey, '/app/receivables', false)
  try {
    assert.ok(on.container.querySelector('.receivable-group-card'), '켜면 미수 건이 다시 보여야 한다')
    assert.equal((on.container.textContent || '').includes('꺼져 있어요'), false)
  } finally {
    await on.cleanup()
  }
})

test('남은 건 0건(기록 없는 거래처)이면 "남은 미수금이 없습니다."', async () => {
  const ownerKey = 'test-recv-empty'
  seed(ownerKey, [{ id: 'c-main', type: 'main', number: '12가3456' }])
  const view = await renderAt(ownerKey, '/app/receivables/Z/2026-09', false)
  try {
    const text = view.container.textContent || ''
    assert.ok(text.includes('남은 미수금이 없습니다.'), text.slice(0, 300))
    assert.equal(text.includes('입금 완료 처리되었습니다'), false)
  } finally {
    await view.cleanup()
  }
})
