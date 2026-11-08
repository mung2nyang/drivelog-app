// 콜 상세 플랫폼 칩: 저장된 목록으로 그림, [저장]할 때 새 이름을 맨 뒤 칩으로, 9개면 안내만, 길게 눌러 지우기, 칩 저장 실패 안내.
// 설정 저장은 이 휴대폰 저장과 같은 동작을 하는 가짜로 바꿔 끼우고(실패 흉내 가능), 화면은 저장된 설정을 다시 읽어 그린다.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/stubSupabaseClient.js'
import '../../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const save = { calls: 0, fail: false }
const { commitSettings } = await import('../../../data/store/commitHelpers.ts')
const { readOwnerSettings, useOwnerSettings } = await import('../../../data/store/ownerDataHooks.ts')
const { normalizeSettings } = await import('../../../domain/practiceSettings.ts')
mock.module('../../../data/sync/settingsSave.ts', {
  namedExports: {
    savePracticeSettings: async (/** @type {string} */ ownerKey, /** @type {(current: object) => object} */ patch) => {
      save.calls += 1
      if (save.fail) throw new Error('저장 실패 흉내')
      const current = readOwnerSettings(ownerKey)
      const next = normalizeSettings({ ...current, ...patch(current) })
      commitSettings(ownerKey, next)
      return next
    },
    applyTheme: () => {},
  },
})

const React = await import('react')
const { withSession } = await import('../../../testSupport/withSession.js')
const { withToast } = await import('../../../testSupport/withToast.js')
const { act } = React
const { createRoot } = await import('react-dom/client')
const { BrowserRouter } = await import('react-router-dom')
const { commitWorkData } = await import('../../../data/store/commitHelpers.ts')
const { default: DayLogPage } = await import('./DayLogPage.jsx')

const DATE = '2026-10-17'
const DEFAULTS = ['24시콜', '화물맨', '더운반', '원콜', '전국화물콜', '카카오T트럭커']
const FULL_NOTICE = '플랫폼 칩은 최대 9개입니다. 칩을 길게 눌러 하나를 지워 주세요.'

/** @param {{ ownerKey: string }} props */
function Page({ ownerKey }) {
  const settings = useOwnerSettings(ownerKey)
  return React.createElement(DayLogPage, { month: 10, day: 17, dateKey: DATE, clients: [], settings })
}

/** @param {string} ownerKey @param {object} [settings] @param {Array<object>} [calls] */
async function render(ownerKey, settings = {}, calls = []) {
  save.fail = false
  commitSettings(ownerKey, normalizeSettings({ callDetail: true, platformOn: true, ...settings }))
  commitWorkData(ownerKey, calls.length ? { [DATE]: { callDetails: calls } } : {})
  window.history.replaceState(null, '', `/app/day/${DATE}`)
  const toasts = /** @type {Array<string>} */ ([])
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(withToast(React.createElement(BrowserRouter, null, withSession(React.createElement(Page, { ownerKey }), { ownerKey })), (/** @type {string} */ m) => { toasts.push(m) }))
  })
  /** @param {string} text */
  const button = (text) => [...document.querySelectorAll('button')].find((el) => el.textContent?.trim() === text)
  /** @param {Element|undefined|null} el @param {string} [type] */
  const fire = async (el, type = 'click') => {
    assert.ok(el, type)
    await act(async () => { el.dispatchEvent(new window.MouseEvent(type, { bubbles: true })) })
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0) }) })
  }
  /** @param {string} selector @param {string} value */
  const type = async (selector, value) => {
    const el = /** @type {HTMLInputElement|null} */ (container.querySelector(selector))
    assert.ok(el, selector)
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    await act(async () => { setter?.call(el, value); el.dispatchEvent(new window.Event('input', { bubbles: true })) })
  }
  const chips = () => [...container.querySelectorAll('.call-platform-quick-list .dark-pill-btn')].map((el) => el.textContent)
  /** @param {string} name */
  const chip = (name) => [...container.querySelectorAll('.call-platform-quick-list .dark-pill-btn')].find((el) => el.textContent === name)
  /** @param {string} name */
  const longPress = async (name) => {
    await fire(chip(name), 'pointerdown')
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 650) }) })
  }
  const saveNewCall = async (/** @type {string} */ platform) => {
    await fire(button('+ 세부 내역 추가'))
    await type('#callLoadLoc', '광주')
    await type('#callFare', '30000')
    await type('#callPlatform', platform)
    await fire(button('저장'))
  }
  return {
    container, toasts, button, fire, type, chips, chip, longPress, saveNewCall,
    async cleanup() { await act(async () => { root.unmount() }); container.remove() },
  }
}

test('따로 저장한 적 없으면 기본 6개, 짧게 누르면 칸에 넣고 다시 누르면 비운다', async () => {
  const view = await render('platform-chips-tap')
  try {
    await view.fire(view.button('+ 세부 내역 추가'))
    assert.deepEqual(view.chips(), DEFAULTS)
    const input = /** @type {HTMLInputElement} */ (view.container.querySelector('#callPlatform'))
    await view.fire(view.chip('화물맨'))
    assert.equal(input.value, '화물맨')
    await view.fire(view.chip('화물맨'))
    assert.equal(input.value, '')
  } finally {
    await view.cleanup()
  }
})

test('저장된 목록 순서대로 그리고, 새 이름을 쓰고 [저장]하면 맨 뒤 칩으로 저장된다(이미 있으면 그대로)', async () => {
  const view = await render('platform-chips-add', { platformPresets: ['원콜', '화물맨'] })
  try {
    await view.saveNewCall('  테스트콜 ')
    assert.deepEqual(view.toasts, ['세부 입력을 저장했습니다.'])
    assert.deepEqual(readOwnerSettings('platform-chips-add').platformPresets, ['원콜', '화물맨', '테스트콜'])
    await view.fire(view.button('+ 세부 내역 추가'))
    assert.deepEqual(view.chips(), ['원콜', '화물맨', '테스트콜'])
    await view.fire(view.button('취소'))
    const before = save.calls
    await view.saveNewCall('원콜')
    assert.equal(save.calls, before, '이미 있는 이름이면 설정을 저장하지 않는다')
  } finally {
    await view.cleanup()
  }
})

test('예전 콜을 고쳐 [저장]해도 그 플랫폼 이름이 칩이 된다', async () => {
  const view = await render('platform-chips-edit', {}, [{ id: 'call-1', loadLoc: '부산', unloadLoc: '대구', client: '', fare: '50000', platform: '옛콜' }])
  try {
    await view.fire(view.container.querySelector('[title="수정"]'))
    await view.fire(view.button('저장'))
    assert.deepEqual(view.toasts, ['세부 입력을 수정했습니다.'])
    assert.deepEqual(readOwnerSettings('platform-chips-edit').platformPresets, [...DEFAULTS, '옛콜'])
  } finally {
    await view.cleanup()
  }
})

test('칩이 9개면 콜은 저장하고 칩은 안 더하며 가득 찼다는 안내를 띄운다', async () => {
  const full = [...DEFAULTS, '가', '나', '다']
  const view = await render('platform-chips-full', { platformPresets: full })
  try {
    const before = save.calls
    await view.saveNewCall('라')
    assert.equal(view.container.querySelectorAll('.call-detail-card-foot').length, 1, '콜은 저장된다')
    assert.deepEqual(view.toasts, [FULL_NOTICE])
    assert.equal(save.calls, before)
    assert.deepEqual(readOwnerSettings('platform-chips-full').platformPresets, full)
  } finally {
    await view.cleanup()
  }
})

test('칩을 길게 누르면 확인 창, [취소]면 그대로, [삭제]면 지운다(기본 칩도) — 길게 누른 뒤 떼도 고르지 않는다', async () => {
  const view = await render('platform-chips-remove')
  try {
    await view.fire(view.button('+ 세부 내역 추가'))
    const input = /** @type {HTMLInputElement} */ (view.container.querySelector('#callPlatform'))
    await view.longPress('화물맨')
    assert.ok(document.body.textContent?.includes("'화물맨' 칩을 삭제하시겠습니까?"))
    await view.fire(view.chip('화물맨'))
    assert.equal(input.value, '', '길게 누른 뒤의 클릭은 고르기가 아니다')
    await view.fire(view.button('취소'))
    assert.deepEqual(view.chips(), DEFAULTS)
    await view.longPress('화물맨')
    await view.fire(view.button('삭제'))
    assert.deepEqual(readOwnerSettings('platform-chips-remove').platformPresets, DEFAULTS.filter((name) => name !== '화물맨'))
    assert.deepEqual(view.chips(), DEFAULTS.filter((name) => name !== '화물맨'))
  } finally {
    await view.cleanup()
  }
})

test('칩 저장이 실패하면 "플랫폼 칩 저장에 실패했습니다." — 콜 저장은 그대로', async () => {
  const view = await render('platform-chips-fail')
  try {
    save.fail = true
    await view.saveNewCall('실패콜')
    assert.equal(view.container.querySelectorAll('.call-detail-card-foot').length, 1)
    assert.deepEqual(view.toasts, ['세부 입력을 저장했습니다.', '플랫폼 칩 저장에 실패했습니다.'])
    await view.fire(view.button('+ 세부 내역 추가'))
    await view.longPress('원콜')
    await view.fire(view.button('삭제'))
    assert.equal(view.toasts.at(-1), '플랫폼 칩 저장에 실패했습니다.')
    assert.deepEqual(view.chips(), DEFAULTS)
  } finally {
    await view.cleanup()
  }
})
