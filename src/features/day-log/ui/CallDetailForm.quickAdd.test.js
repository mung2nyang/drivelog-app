import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/stubSupabaseClient.ts'
import '../../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { normalizeSettings } from '../../../domain/practiceSettings.ts'

const SAVED = { id: 'new-1', companyName: '새거래처', paymentTerm: 'after_days', paymentTermValue: 10 }
const saveResult = { clients: [SAVED], toast: null, failed: false, saved: SAVED }
mock.module('../../../data/sync/clientMutations.ts', { namedExports: { requestClientSave: async () => saveResult } })

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: CallDetailForm } = await import('./CallDetailForm.tsx')

const OLD = { id: 'old-1', companyName: '대한', paymentTerm: 'second_month_end' }

function typeInto(/** @type {HTMLInputElement} */ input, /** @type {string} */ value) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set?.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}

/** @param {object|null} [value] */
async function mount(value = null) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(CallDetailForm, {
      value, previousItem: null, dateKey: '2026-09-27', clients: [OLD], settings: normalizeSettings({ paymentOn: true }),
      onSave: () => {}, onClose: () => {},
    }))
  })
  const due = () => /** @type {HTMLInputElement} */ (container.querySelector('#callPaymentDueDate')).value
  async function quickAdd() {
    await act(async () => { /** @type {HTMLButtonElement} */ (container.querySelector('.call-client-add-btn')).click() })
    await act(async () => { typeInto(/** @type {HTMLInputElement} */ (document.querySelector('input[placeholder="거래처명 입력"]')), '새거래처') })
    const save = [...document.querySelectorAll('button')].find((button) => button.textContent === '저장' && button.classList.contains('confirm'))
    await act(async () => { save?.click(); await new Promise((resolve) => setTimeout(resolve, 20)) })
  }
  return { container, due, quickAdd, async cleanup() { await act(async () => { root.unmount() }); container.remove() } }
}

test('빠른 추가로 만든 거래처는 바로 그 거래처 조건으로 입금 예정일을 채운다', async () => {
  const view = await mount()
  try {
    assert.equal(view.due(), '2026-10-31')
    await view.quickAdd()
    assert.equal(/** @type {HTMLInputElement} */ (view.container.querySelector('#callClient')).value, '새거래처')
    assert.equal(view.due(), '2026-10-07')
  } finally { await view.cleanup() }
})

test('직접 고른 날짜가 있는 콜에서 빠른 추가로 만들어도 고른 날짜 그대로', async () => {
  const view = await mount({ id: 'c1', client: '대한', loadLoc: '수원', unloadLoc: '화성', fare: 100000, paymentDueDate: '2026-12-15' })
  try {
    assert.equal(view.due(), '2026-12-15')
    await view.quickAdd()
    assert.equal(/** @type {HTMLInputElement} */ (view.container.querySelector('#callClient')).value, '새거래처')
    assert.equal(view.due(), '2026-12-15')
  } finally { await view.cleanup() }
})
