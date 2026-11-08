// 창 뒤로가기 장치 + 일지 입력 칸 장치를 함께: 입력 칸이 열린 채 창을 열고 뒤로가기 → 창만 닫히고 입력 칸 그대로, 그다음은 입력 칸 규칙대로.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act, useState } = React
const { BrowserRouter, useNavigate } = await import('react-router-dom')
const { default: usePanelBackGuard } = await import('./usePanelBackGuard.js')
const { default: useModalBackGuard } = await import('./useModalBackGuard.ts')
const { panelGuardOnTop } = await import('../../../shared/utils/historyMoves.js')

const wait = (/** @type {number} */ ms) => new Promise((resolve) => { setTimeout(resolve, ms) })
const modalGuardOnTop = () => Boolean(Reflect.get(window.history.state || {}, 'modalGuard'))

test('입력 칸이 열린 채 창을 열고 뒤로가기 → 창만 닫힘(입력 칸·주소 그대로, 묻지 않음), 한 번 더 → 입력 칸 규칙대로 묻기', async () => {
  window.history.replaceState(null, '', '/app/calendar')
  const calls = { confirm: 0, leave: 0 }
  /** @type {{ panel: (open: boolean) => void, modal: (open: boolean) => void, go: ReturnType<typeof useNavigate> | null, state: { panel: boolean, modal: boolean } }} */
  const ctl = { panel: () => {}, modal: () => {}, go: null, state: { panel: false, modal: false } }
  function Probe() {
    const [panel, setPanel] = useState(false)
    const [modal, setModal] = useState(false)
    ctl.panel = setPanel
    ctl.modal = setModal
    ctl.state = { panel, modal }
    ctl.go = useNavigate()
    usePanelBackGuard(panel, async () => { calls.confirm += 1; return false }, () => { calls.leave += 1; setPanel(false) })
    useModalBackGuard(modal, () => { setModal(false) })
    return null
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => { root.render(React.createElement(BrowserRouter, null, React.createElement(Probe))) })
  await act(async () => { ctl.go?.('/app/day/2026-10-15') })
  const back = async () => {
    await act(async () => {
      const popped = new Promise((resolve) => { window.addEventListener('popstate', () => resolve(undefined), { once: true }) })
      window.history.back()
      await Promise.race([popped, wait(500)])
      await wait(20)
    })
  }
  try {
    await act(async () => { ctl.panel(true); await wait(20) })
    assert.equal(panelGuardOnTop(), true)
    await act(async () => { ctl.modal(true); await wait(20) })
    assert.equal(modalGuardOnTop(), true)
    await back()
    assert.equal(ctl.state.modal, false, '창 닫힘')
    assert.equal(ctl.state.panel, true, '입력 칸 그대로')
    assert.equal(calls.confirm, 0, '입력 칸 확인은 안 물음')
    assert.equal(window.location.pathname, '/app/day/2026-10-15')
    assert.equal(panelGuardOnTop(), true, '입력 칸 붙잡기 기록이 맨 위')
    await back()
    assert.equal(calls.confirm, 1, '그다음은 입력 칸 규칙(묻기)')
    assert.equal(ctl.state.panel, true, '[계속 입력]이면 그대로')
  } finally {
    await act(async () => { root.unmount() })
    container.remove()
  }
})
