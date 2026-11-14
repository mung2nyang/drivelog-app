import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/stubSupabaseClient.ts'
import '../../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { normalizeSettings } from '../../../domain/practiceSettings.ts'

function assertMissing(/** @type {Element|null} */ el, /** @type {string} */ message) {
  assert.equal(!!el, false, message)
}

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: CallDetailForm } = await import('./CallDetailForm.tsx')

const noop = () => {}
const PAYMENT_ON_SETTINGS = normalizeSettings({ paymentOn: true })

/** @param {Partial<Parameters<typeof CallDetailForm>[0]>} props */
async function mount(props) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(CallDetailForm, {
      value: null, previousItem: null, dateKey: '2026-09-27', clients: [], settings: PAYMENT_ON_SETTINGS,
      onSave: noop, onClose: noop, ...props,
    }))
  })
  return { container, async cleanup() { await act(async () => { root.unmount() }); container.remove() } }
}

test('결제 및 수금 입력이 켜져 있고 기사연동 계정이 아니면 산재보험료 칸이 보인다(기존 동작)', async () => {
  const view = await mount({ isEmployedDriver: false })
  try {
    assert.ok(view.container.querySelector('#callInsuranceFee'))
  } finally { await view.cleanup() }
})

test('기사연동 계정이면 결제 및 수금 입력이 켜져 있어도 산재보험료 칸이 안 보인다', async () => {
  const view = await mount({ isEmployedDriver: true })
  try {
    assertMissing(view.container.querySelector('#callInsuranceFee'), '산재보험료 칸이 없어야 한다')
    assert.ok(view.container.querySelector('#callVatExempt'))
    assert.ok(view.container.querySelector('#callPaymentDueDate'))
  } finally { await view.cleanup() }
})

test('isEmployedDriver를 안 넘기면(기본값) 미연동과 같은 기존 동작 — 칸이 보인다', async () => {
  const view = await mount({})
  try {
    assert.ok(view.container.querySelector('#callInsuranceFee'))
  } finally { await view.cleanup() }
})

test('이미 산재보험료 값이 있는 콜 상세를 기사연동 계정이 열어도 칸만 숨고 값은 저장 시 그대로 남는다', async () => {
  let saved = /** @type {{ insuranceFee?: string }|null} */ (null)
  const view = await mount({
    value: { id: 'c1', loadLoc: '', unloadLoc: '', fare: '100,000', client: '', insuranceFee: '3,000' },
    isEmployedDriver: true,
    onSave: (/** @type {{ insuranceFee?: string }} */ draft) => { saved = draft },
  })
  try {
    assertMissing(view.container.querySelector('#callInsuranceFee'), '칸은 숨는다')
    const saveBtn = /** @type {HTMLButtonElement} */ (view.container.querySelector('.modal-btn.confirm'))
    assert.ok(saveBtn)
    await act(async () => { saveBtn.click() })
    assert.equal(saved?.insuranceFee, '3,000', '입력칸이 안 보여도 기존 값은 지워지지 않고 그대로 저장된다')
  } finally { await view.cleanup() }
})

test('결제 및 수금 입력이 꺼져 있으면 기사연동 여부와 무관하게 산재보험료 칸이 안 보인다(기존 동작 불변)', async () => {
  const paymentOffSettings = normalizeSettings({ paymentOn: false })
  const view = await mount({ settings: paymentOffSettings, isEmployedDriver: false })
  try {
    assertMissing(view.container.querySelector('#callInsuranceFee'), '결제 스위치가 꺼지면 칸이 없어야 한다')
  } finally { await view.cleanup() }
})

test('운송료 이름표 "(부가세 별도)"는 보통 공백 — 큰 글씨에서 줄을 바꿔 칸 안에 들어간다(로드맵 49)', async () => {
  const view = await mount({})
  try {
    const label = view.container.querySelector('label[for="callFare"]')
    const text = label?.textContent || ''
    assert.equal(text, '운송료(부가세 별도)')
    assert.equal(text.includes(' '), false, '줄바꿈 안 되는 공백이 없어야 한다')
  } finally { await view.cleanup() }
})

test('부가세 포함 미리보기는 원 미만 버림 — 15,555원이면 17,110원(로드맵 102)', async () => {
  const view = await mount({ value: { id: 'c1', fare: '15,555', client: '' } })
  try {
    assert.equal((view.container.textContent || '').match(/부가세 포함 [\d,]+원/)?.[0], '부가세 포함 17,110원')
  } finally { await view.cleanup() }
})

test('부가세 미리보기는 면세 체크와 같은 줄 오른쪽, 면세면 "부가세 0원", 공급가액 안내는 (i) 속에만', async () => {
  const view = await mount({ value: { id: 'c1', fare: '100,000', client: '' } })
  const exempt = await mount({ value: { id: 'c1', fare: '100,000', client: '', vatExempt: true } })
  try {
    const row = view.container.querySelector('.call-vat-row')
    assert.ok(row?.querySelector('#callVatExempt'))
    assert.equal(row?.querySelector('.call-vat-preview')?.textContent, '부가세 포함 110,000원')
    assert.equal(exempt.container.querySelector('.call-vat-row .call-vat-preview')?.textContent, '부가세 0원')
    assert.equal((view.container.textContent || '').includes('1.1로 나눈'), false, '접힌 상태에서는 안내 문장이 안 보인다')
  } finally { await view.cleanup(); await exempt.cleanup() }
})

test('면세 옆 (i)를 누르면 공급가액 안내가 펼쳐지고 면세 체크는 그대로다', async () => {
  const view = await mount({ value: { id: 'c1', fare: '100,000', client: '' } })
  try {
    const button = /** @type {HTMLButtonElement|null} */ (view.container.querySelector('.call-vat-row button[aria-label="부가세 입력 설명 보기"]'))
    assert.ok(button)
    await act(async () => { button.click() })
    assert.equal(view.container.querySelector('.call-vat-row .summary-info-text')?.textContent,
      '부가가치세가 포함된 금액이라면 1.1로 나눈 공급가액을 입력해 주세요.\n(예:\u00a0110,000원\u00a0→\u00a0100,000원)', '예시는 괄호 앞에서 줄을 바꾸고 안에서는 안 나뉜다')
    assert.equal(/** @type {HTMLInputElement|null} */ (view.container.querySelector('#callVatExempt'))?.checked, false)
  } finally { await view.cleanup() }
})

describe('운송료 1,000만원 초과 저장 확인(로드맵 43-C)', () => {
  /** @param {string} fare @param {boolean} answer */
  async function clickSave(fare, answer) {
    /** @type {Array<string>} */
    const asked = []
    let saved = 0
    const original = window.confirm
    window.confirm = (/** @type {string|undefined} */ message) => { asked.push(String(message)); return answer }
    const view = await mount({
      value: { id: 'c1', loadLoc: 'A', unloadLoc: '', fare, client: '' },
      onSave: () => { saved += 1 },
    })
    try {
      const saveBtn = /** @type {HTMLButtonElement} */ (view.container.querySelector('.modal-btn.confirm'))
      assert.ok(saveBtn)
      await act(async () => { saveBtn.click() })
      return { asked, saved, stillOpen: !!view.container.querySelector('#callFare') }
    } finally {
      window.confirm = original
      await view.cleanup()
    }
  }

  test('초과 + 취소 → 저장 안 함, 입력 창 그대로', async () => {
    const result = await clickSave('20,000,000', false)
    assert.deepEqual(result.asked, ['운송료가 1,000만원을 넘습니다\n입력한 운송료는 20,000,000원입니다. 이 금액이 맞으면 저장해 주세요.'])
    assert.equal(result.saved, 0)
    assert.equal(result.stillOpen, true)
  })

  test('초과 + 확인 → 저장', async () => {
    const result = await clickSave('20,000,000', true)
    assert.equal(result.asked.length, 1)
    assert.equal(result.saved, 1)
  })

  test('딱 1,000만원이면 확인 창 없이 저장', async () => {
    const result = await clickSave('10,000,000', false)
    assert.equal(result.asked.length, 0)
    assert.equal(result.saved, 1)
  })
})

/** React 제어 입력에 값을 넣고 input 이벤트를 보낸다. @param {HTMLInputElement} input @param {string} value */
function typeInto(input, value) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}

describe('입력이 잘못된 칸 표시(로드맵 82-C)', () => {
  test('아무것도 안 넣고 저장 → 상차지 칸 표시·문구·커서, 저장 안 함, 채우면 사라짐', async () => {
    /** @type {Array<object>} */
    const saves = []
    const view = await mount({ onSave: (/** @type {object} */ item) => saves.push(item) })
    try {
      const saveButton = [...view.container.querySelectorAll('button')].find((button) => button.textContent === '저장')
      await act(async () => { saveButton?.click() })
      const input = /** @type {HTMLInputElement} */ (view.container.querySelector('#callLoadLoc'))
      assert.equal(saves.length, 0)
      assert.equal(input.getAttribute('aria-invalid'), 'true')
      assert.equal(view.container.querySelector('#callLoadLoc-error')?.textContent, '운임, 상차지, 하차지 중 하나를 입력해 주세요.')
      assert.equal(document.activeElement, input)
      await act(async () => { typeInto(input, '부산') })
      assert.equal(input.getAttribute('aria-invalid'), null)
      assertMissing(view.container.querySelector('#callLoadLoc-error'), '채우면 문구가 사라져야 한다')
    } finally { await view.cleanup() }
  })

  test('마감 계기판이 출발보다 작으면 마감 칸 표시·문구, 고치면 운행거리', async () => {
    const view = await mount({ settings: normalizeSettings({ distanceOn: true }) })
    try {
      const start = /** @type {HTMLInputElement} */ (view.container.querySelector('#callStartOdometer'))
      const end = /** @type {HTMLInputElement} */ (view.container.querySelector('#callEndOdometer'))
      await act(async () => { typeInto(start, '1000') })
      await act(async () => { typeInto(end, '900') })
      assert.equal(end.getAttribute('aria-invalid'), 'true')
      assert.equal(view.container.querySelector('#callEndOdometer-error')?.textContent, '마감 계기판이 출발 계기판보다 작습니다.')
      await act(async () => { typeInto(end, '1100') })
      assert.equal(end.getAttribute('aria-invalid'), null)
      assert.ok(view.container.textContent?.includes('운행거리 100km'))
    } finally { await view.cleanup() }
  })
})

test('운비서 처음 값(prefill)은 새 입력으로 채운다 — 제목에 "수정"이 붙지 않는다(로드맵 24-B-2)', async () => {
  const view = await mount({ prefill: { loadLoc: '수원', unloadLoc: '화성', fare: 150000, client: '한진' } })
  try {
    const value = (/** @type {string} */ id) => /** @type {HTMLInputElement|null} */ (view.container.querySelector(`#${id}`))?.value
    assert.equal(view.container.querySelector('.call-detail-modal-title')?.textContent, '27일 운행일지 세부 내역 입력')
    assert.equal(value('callLoadLoc'), '수원')
    assert.equal(value('callUnloadLoc'), '화성')
    assert.equal(value('callFare'), '150,000')
    assert.equal(value('callClient'), '한진')
  } finally { await view.cleanup() }
})
