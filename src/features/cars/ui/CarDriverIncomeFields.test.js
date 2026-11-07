// 로드맵 4-2 — 기사차량 폼의 기사 유형·산재보험·원천징수(3.3%)·필요경비율·산재보험료율 블록.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: CarDriverIncomeFields } = await import('./CarDriverIncomeFields.jsx')
const { default: CarFormModal } = await import('./CarFormModal.jsx')

/** @typedef {import('./CarFormModal.jsx').CarFormDraft} CarFormDraft */
/** @typedef {{ draft: CarFormDraft, setDraft: import('react').Dispatch<import('react').SetStateAction<CarFormDraft>> }} HarnessProps */

/** @type {CarFormDraft} */
const SUB_DRAFT = {
  number: '12가3456', tonnage: '', type: 'sub', driverName: '', driverPhone: '',
  driverPayMode: 'revenue', driverSalaryAmount: '', commEnabled: true, commType: 'percent', commission: '20',
  driverIncomeType: 'business', insuranceOn: true, withholdingOn: true, expenseRate: '49.9', insuranceRate: '1.76',
  inviteCode: '', inviteStartDate: '', inviteDriverId: null, connectMode: 'log',
}

/** @param {HTMLElement} container @param {string} selector */
function el(container, selector) {
  const found = container.querySelector(selector)
  assert.ok(found, selector)
  return /** @type {HTMLInputElement} */ (found)
}

/** React 제어 입력에 값을 넣고 input 이벤트를 보낸다. @param {Element} target @param {string} value */
function typeInto(target, value) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value')?.set
  assert.ok(setter)
  setter.call(target, value)
  target.dispatchEvent(new window.Event('input', { bubbles: true }))
}

/**
 * draft 상태를 들고 있는 하네스를 그리고, 현재 draft를 읽는 함수를 돌려준다.
 * @param {(props: HarnessProps) => import('react').ReactElement} render
 * @param {CarFormDraft} [initial]
 */
async function mount(render, initial = SUB_DRAFT) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  let current = initial
  function Harness() {
    const [draft, setDraft] = React.useState(initial)
    current = draft
    return render({ draft, setDraft })
  }
  await act(async () => { root.render(React.createElement(Harness)) })
  return {
    container,
    draft: () => current,
    async cleanup() {
      await act(async () => { root.unmount() })
      container.remove()
    },
  }
}

/** @param {HarnessProps} props */
const fields = ({ draft, setDraft }) => React.createElement(CarDriverIncomeFields, { draft, setDraft })

test('기사 유형은 원천징수·산재 부담 기본값을 바꾸고 산재 토글은 그대로 둔다', async () => {
  const view = await mount(fields)
  try {
    const buttons = /** @type {Array<HTMLButtonElement>} */ ([...view.container.querySelectorAll('[aria-label="기사 유형"] button')])
    assert.deepEqual(buttons.map((b) => b.textContent), ['4대보험 근로자', '3.3% 사업소득자'])
    await act(async () => { buttons[0].click() })
    assert.equal(view.draft().driverIncomeType, 'employee')
    assert.equal(view.draft().insuranceSplit, 'owner', '근로자 → 산재 부담 기본 차주 전액')
    assert.equal(el(view.container, '#newCarInsuranceOn').checked, true, '근로자도 산재 적용(차주 전액 부담)')
    assert.equal(el(view.container, '#newCarWithholdingOn').checked, false)
    await act(async () => { el(view.container, '#newCarWithholdingOn').click() })
    assert.equal(view.draft().withholdingOn, true, '근로자여도 예외로 원천징수만 켤 수 있다')
    await act(async () => { buttons[1].click() })
    assert.equal(view.draft().driverIncomeType, 'business')
    assert.equal(view.draft().insuranceSplit, 'half', '사업소득자 → 산재 부담 기본 반반')
    assert.equal(view.draft().insuranceOn, true)
    assert.equal(view.draft().withholdingOn, true)
  } finally { await view.cleanup() }
})

test('산재 부담 버튼 3개는 산재 적용을 켰을 때만 보이고, 누른 값이 저장 draft에 들어간다', async () => {
  const view = await mount(fields)
  const splitButtons = () => /** @type {Array<HTMLButtonElement>} */ ([...view.container.querySelectorAll('[aria-label="산재 부담"] button')])
  try {
    assert.deepEqual(splitButtons().map((b) => b.textContent), ['차주 전액', '반반', '기사 전액'])
    assert.deepEqual(splitButtons().map((b) => b.getAttribute('aria-pressed')), ['false', 'true', 'false'], '기본은 반반')
    await act(async () => { splitButtons()[2].click() })
    assert.equal(view.draft().insuranceSplit, 'driver')
    assert.equal(splitButtons()[2].getAttribute('aria-pressed'), 'true')
    await act(async () => { el(view.container, '#newCarInsuranceOn').click() })
    assert.equal(splitButtons().length, 0, '산재 끄면 숨김')
  } finally { await view.cleanup() }
})

test('기사 유형 안내 문구에는 산재 부담 설명이 없다', async () => {
  const view = await mount(fields)
  try {
    const guide = () => view.container.querySelector('.car-settlement-mode-guide')?.textContent || ''
    assert.equal(guide(), '사업소득자(3.3%)는 기사 정산액에서 사업소득세 3.3%를 공제합니다.')
    await act(async () => { /** @type {HTMLButtonElement} */ (view.container.querySelector('[aria-label="기사 유형"] button')).click() })
    assert.equal(guide(), '4대 보험 근로자는 기사 정산액에서 사업소득세 3.3%를 공제하지 않습니다.')
  } finally { await view.cleanup() }
})

test('산재 적용을 끄면 두 요율이 0이 되고 숨겨지며, 켜면 기본값으로 다시 보인다', async () => {
  const view = await mount(fields)
  try {
    await act(async () => { el(view.container, '#newCarInsuranceOn').click() })
    assert.equal(view.draft().insuranceOn, false)
    assert.equal(view.draft().insuranceRate, '0')
    assert.equal(view.draft().expenseRate, '0')
    assert.equal(view.container.querySelector('#newCarInsuranceRate'), null)
    assert.equal(view.container.querySelector('#newCarExpenseRate'), null)
    await act(async () => { el(view.container, '#newCarInsuranceOn').click() })
    assert.equal(view.draft().insuranceRate, '1.76')
    assert.equal(view.draft().expenseRate, '49.9')
    assert.equal(el(view.container, '#newCarExpenseRate').value, '49.9')
  } finally { await view.cleanup() }
})

test('필요경비율·산재보험료율 입력은 숫자와 소수점만 남기고 100을 넘지 않는다', async () => {
  const view = await mount(fields)
  try {
    await act(async () => { typeInto(el(view.container, '#newCarExpenseRate'), '43.1abc') })
    assert.equal(view.draft().expenseRate, '43.1')
    await act(async () => { typeInto(el(view.container, '#newCarInsuranceRate'), '250') })
    assert.equal(view.draft().insuranceRate, '100')
    await act(async () => { typeInto(el(view.container, '#newCarInsuranceRate'), '0') })
    assert.equal(view.draft().insuranceRate, '0', '0은 산재 적용 제외로 그대로 둔다')
  } finally { await view.cleanup() }
})

test('필요경비율은 품목·차종 선택 없이 기본값 49.9로 시작하고 직접 고칠 수 있다', async () => {
  const view = await mount(fields)
  try {
    assert.equal(view.container.querySelector('.app-dropdown-trigger'), null, '품목·차종 선택칸 없음')
    assert.equal(el(view.container, '#newCarExpenseRate').value, '49.9')
    await act(async () => { typeInto(el(view.container, '#newCarExpenseRate'), '43.1') })
    assert.equal(view.draft().expenseRate, '43.1', '숫자를 직접 고칠 수 있다')
  } finally { await view.cleanup() }
})

test('차량 폼: 기사차량에는 이 블록이 보이고 메인 차량에는 보이지 않는다', async () => {
  /** @param {HarnessProps} props */
  const modal = ({ draft, setDraft }) => React.createElement(CarFormModal, { draft, setDraft, editingId: null, onCancel: () => {}, onSave: () => {}, cloud: false, drivers: [] })
  const sub = await mount(modal)
  try {
    for (const id of ['#newCarInsuranceOn', '#newCarWithholdingOn', '#newCarExpenseRate', '#newCarInsuranceRate']) assert.ok(sub.container.querySelector(id), id)
    assert.equal(el(sub.container, '#newCarExpenseRate').value, '49.9')
    assert.equal(el(sub.container, '#newCarInsuranceRate').value, '1.76')
  } finally { await sub.cleanup() }
  const main = await mount(modal, { ...SUB_DRAFT, type: 'main' })
  try {
    for (const id of ['#newCarInsuranceOn', '#newCarWithholdingOn', '#newCarExpenseRate', '#newCarInsuranceRate']) assert.equal(main.container.querySelector(id), null, id)
  } finally { await main.cleanup() }
})
