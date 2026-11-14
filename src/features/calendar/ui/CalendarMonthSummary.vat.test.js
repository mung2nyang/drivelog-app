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
const { default: CalendarMonthSummary } = await import('./CalendarMonthSummary.tsx')

const SUMMARY = {
  trips: 2, callTrips: 0, fixedBaseFare: 0, defaultBaseFare: 200000, fareByClient: {}, commissionByClient: {},
  commissionLabelByClient: {}, palletFare: 0, subCarComm: 0, subCarCommLabel: '기사 차량 수수료', distanceKm: 0,
  fare: 200000, commissionTotal: 0, insuranceTotal: 1000, vat: 20000, total: 219000, maint: 0, fuel: 0, misc: 0,
}

/** @param {typeof SUMMARY} summary */
async function render(summary) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(CalendarMonthSummary, { paymentOn: false, unpaidTotal: 0, summary }))
  })
  const rows = [...container.querySelectorAll('.summary-row')].map((row) => row.textContent)
  return { container, rows, cleanup: async () => { await act(async () => { root.unmount() }); container.remove() } }
}

test('산재보험료 → 합계 (부가세 제외) → 부가세 → 합계 (부가세 포함), 제외 값은 합계 − 부가세', async () => {
  const { container, rows, cleanup } = await render(SUMMARY)
  try {
    assert.deepEqual(rows.slice(-4), ['산재보험료- 1,000원', '합계 (부가세 제외)199,000원', '부가세 (공급가액 기준 10%)20,000원', '합계 (부가세 포함)219,000원'])
    assert.ok(container.querySelector('.summary-row.summary-subtotal')?.textContent?.startsWith('합계 (부가세 제외)'))
    assert.ok(container.querySelector('.summary-row.total')?.textContent?.startsWith('합계 (부가세 포함)'))
    assert.equal(container.querySelector('.summary-row.total .summary-total-vat')?.textContent, '(부가세 포함)')
  } finally {
    await cleanup()
  }
})

test('부가세가 0이어도 부가세 제외 합계 줄이 보이고 두 합계가 같다', async () => {
  const { rows, cleanup } = await render({ ...SUMMARY, insuranceTotal: 0, vat: 0, total: 200000 })
  try {
    assert.deepEqual(rows.slice(-3), ['합계 (부가세 제외)200,000원', '부가세 (공급가액 기준 10%)0원', '합계 (부가세 포함)200,000원'])
  } finally {
    await cleanup()
  }
})

test('큰 합계 아래 구분선은 맨 처음 나오는 지출 줄에만 — 정비비가 없으면 주유비, 그것도 없으면 통행료/기타', async () => {
  for (const [expense, first] of /** @type {Array<[Record<string, number>, string]>} */ ([
    [{ maint: 5000, fuel: 3000, misc: 1000 }, '차량 정비비'], [{ fuel: 3000, misc: 1000 }, '차량 주유비'], [{ misc: 1000 }, '통행료/기타'], [{}, ''],
  ])) {
    const { container, cleanup } = await render({ ...SUMMARY, ...expense })
    try {
      const lined = [...container.querySelectorAll('.summary-expense-first')]
      assert.deepEqual(lined.map((row) => (row.textContent || '').replace(/[\d,]+원$/, '').trim()), first ? [first] : [])
      if (first) assert.equal(/** @type {HTMLElement} */ (lined[0]).style.paddingTop, '8px')
    } finally {
      await cleanup()
    }
  }
})

test('합계 (i) 설명: 부가세 제외는 수수료·산재보험료를 뺀 금액, 포함은 부가세를 더한 금액', async () => {
  const { container, cleanup } = await render(SUMMARY)
  try {
    const btn = container.querySelector('button[aria-label="합계 설명 보기"]')
    assert.ok(btn instanceof window.HTMLButtonElement)
    await act(async () => { btn.click() })
    assert.equal(
      container.querySelector('.summary-info-text')?.textContent,
      '부가세 제외 합계는 운송료와 파렛트 회수 청구액에서 수수료와 산재보험료를 뺀 금액이고, 부가세 포함 합계는 여기에 부가세를 더한 금액입니다. 아래 정비비, 주유비, 통행료는 이 합계에서 차감하지 않은 이번 달 차량 지출입니다.',
    )
  } finally {
    await cleanup()
  }
})
