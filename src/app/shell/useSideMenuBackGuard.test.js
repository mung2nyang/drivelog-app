// 옆 메뉴 뒤로가기 — 열면 붙잡기 기록 1장, 휴대폰 뒤로가기는 메뉴만 닫음, 바깥 누르기는 그 기록을 조용히 뺌, 항목으로 간 화면에서 뒤로가기 한 번이면 원래 화면.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: SideMenu } = await import('./SideMenu.jsx')

const flush = () => new Promise((resolve) => { setTimeout(resolve, 0) })

/** 브라우저가 기록을 옮기고 popstate를 알릴 때까지. @param {() => boolean} check */
async function waitFor(check) {
  for (let i = 0; i < 50 && !check(); i += 1) await act(async () => { await flush() })
}

const guardOnTop = () => Boolean(Reflect.get(window.history.state || {}, 'menuGuard'))

/** 실제 앱처럼 열림 값은 바깥(AppShell)이 들고, 메뉴는 onClose로 닫는다. */
async function mount() {
  window.history.replaceState({ idx: 3, key: 'home' }, '', '/app')
  const startLength = window.history.length
  /** @type {string[]} */
  const selected = []
  /** @type {(open: boolean) => void} */
  let setOpen = () => {}
  function Host() {
    const [open, setOpenState] = React.useState(false)
    setOpen = setOpenState
    return React.createElement(SideMenu, {
      open,
      onClose: () => setOpenState(false),
      onSelect: (/** @type {string} */ page) => {
        selected.push(page)
        window.history.pushState({ idx: 4, key: page }, '', `/app/${page}`)
      },
    })
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => { root.render(React.createElement(Host)) })
  return {
    container, selected, startLength,
    open: async () => { await act(async () => { setOpen(true) }) },
    isOpen: () => !!container.querySelector('.side-menu'),
    cleanup: async () => { await act(async () => { root.unmount() }); container.remove() },
  }
}

test('열면 같은 기록 표시로 붙잡기 1장, 뒤로가기는 메뉴만 닫고 원래 기록으로', async () => {
  const view = await mount()
  try {
    await view.open()
    assert.equal(guardOnTop(), true)
    assert.equal(Reflect.get(window.history.state, 'idx'), 3, '라우터 기록 번호는 그대로')
    assert.equal(window.location.pathname, '/app')
    window.history.back()
    await waitFor(() => !view.isOpen())
    assert.equal(view.isOpen(), false, '메뉴 닫힘')
    assert.equal(guardOnTop(), false)
    assert.equal(Reflect.get(window.history.state, 'key'), 'home', '원래 기록')
  } finally {
    await view.cleanup()
  }
})

test('바깥을 눌러 닫으면 붙잡기 기록을 조용히 뺀다', async () => {
  const view = await mount()
  try {
    await view.open()
    const overlay = view.container.querySelector('.side-menu-overlay')
    assert.ok(overlay instanceof window.HTMLElement)
    await act(async () => { overlay.click() })
    assert.equal(view.isOpen(), false, '바로 닫힘')
    await waitFor(() => !guardOnTop())
    assert.equal(guardOnTop(), false)
    assert.equal(Reflect.get(window.history.state, 'key'), 'home')
  } finally {
    await view.cleanup()
  }
})

test('항목을 누르면 바로 이동, 그 화면에서 뒤로가기 한 번이면 남은 붙잡기 기록을 건너뛰어 원래 화면', async () => {
  const view = await mount()
  try {
    await view.open()
    const item = [...view.container.querySelectorAll('.dropdown-item')].find((el) => (el.textContent || '').includes('서류 발급'))
    assert.ok(item instanceof window.HTMLElement)
    await act(async () => { item.click() })
    assert.equal(view.isOpen(), false, '바로 닫힘')
    assert.deepEqual(view.selected, ['report'], '바로 이동')
    assert.equal(window.location.pathname, '/app/report')
    window.history.back()
    await waitFor(() => Reflect.get(window.history.state || {}, 'key') === 'home' && !guardOnTop())
    assert.equal(window.location.pathname, '/app')
    assert.equal(guardOnTop(), false, '붙잡기 기록에 머물지 않음')
    assert.equal(Reflect.get(window.history.state, 'key'), 'home', '원래 화면 기록')
  } finally {
    await view.cleanup()
  }
})
