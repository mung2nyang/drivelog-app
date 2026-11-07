// 그림 줄 넘기기 — 칸 위치·시간 계산, 겹침 0이면 바로 넘김, 겹침이 있으면 위 겹을 띄운 뒤 아래 겹을 맞춤,
// 두 바퀴면 다 돈 뒤 알림, 멈춤이면 첫 칸.
import '../../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: useFramePlayer, framePosition, frameTiming } = await import('./useFramePlayer.ts')

test('칸 위치는 첫 칸 0%, 끝 칸 100%, 시간은 한 바퀴를 칸 수로 나눈 것', () => {
  assert.equal(framePosition(0, 21), 0)
  assert.equal(framePosition(20, 21), 100)
  assert.equal(framePosition(10, 21), 50)
  assert.deepEqual(frameTiming({ frames: 20, seconds: 2, blend: 0.5 }), { tick: 100, fade: 50 })
  assert.deepEqual(frameTiming({ frames: 58, seconds: 2, blend: 0 }).fade, 0)
})

/**
 * @param {{ frames: number, seconds: number, blend: number }} strip
 * @param {'infinite' | 2} loops
 * @param {boolean} [still]
 */
async function mount(strip, loops, still = false) {
  const done = { count: 0 }
  function Harness() {
    const { baseRef, topRef } = useFramePlayer(strip, loops, 'k', () => { done.count += 1 }, still)
    return React.createElement('div', null,
      React.createElement('span', { ref: baseRef, id: 'base' }),
      React.createElement('span', { ref: topRef, id: 'top' }))
  }
  const container = document.createElement('div')
  const root = createRoot(container)
  await act(async () => { root.render(React.createElement(Harness)) })
  const base = /** @type {HTMLElement} */ (container.querySelector('#base'))
  const top = /** @type {HTMLElement} */ (container.querySelector('#top'))
  return { base, top, done, unmount: () => act(async () => { root.unmount() }) }
}

test('겹침이 없으면 한 칸 시간마다 아래 겹을 바로 다음 칸으로', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] })
  const view = await mount({ frames: 5, seconds: 0.5, blend: 0 }, 'infinite')
  assert.equal(view.base.style.backgroundPosition, '0% 0px')
  t.mock.timers.tick(100)
  assert.equal(view.base.style.backgroundPosition, '25% 0px')
  t.mock.timers.tick(300)
  assert.equal(view.base.style.backgroundPosition, '100% 0px')
  t.mock.timers.tick(100)
  assert.equal(view.base.style.backgroundPosition, '0% 0px', '끝 칸 다음은 첫 칸')
  assert.equal(view.top.style.opacity, '0')
  await view.unmount()
})

test('겹침이 있으면 위 겹에 다음 칸을 서서히 띄우고, 다 뜨면 아래 겹을 맞춘 뒤 위 겹을 감춘다', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] })
  const view = await mount({ frames: 5, seconds: 0.5, blend: 0.6 }, 'infinite')
  t.mock.timers.tick(100)
  assert.equal(view.top.style.backgroundPosition, '25% 0px')
  assert.equal(view.top.style.opacity, '1')
  assert.equal(view.top.style.transition, 'opacity 60ms linear')
  assert.equal(view.base.style.backgroundPosition, '0% 0px', '뜨는 동안 아래 겹은 앞 칸')
  t.mock.timers.tick(60)
  assert.equal(view.base.style.backgroundPosition, '25% 0px')
  assert.equal(view.top.style.opacity, '0')
  await view.unmount()
})

test('두 바퀴면 다 돈 뒤 한 번 알리고 멈춘다', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] })
  const view = await mount({ frames: 4, seconds: 0.4, blend: 0 }, 2)
  t.mock.timers.tick(700)
  assert.equal(view.done.count, 0, '한 바퀴 반')
  t.mock.timers.tick(100)
  assert.equal(view.done.count, 1)
  assert.equal(view.base.style.backgroundPosition, '100% 0px', '끝 칸에서 멈춤')
  t.mock.timers.tick(1000)
  assert.equal(view.done.count, 1)
  await view.unmount()
})

test('멈춤이면 첫 칸에 그대로', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] })
  const view = await mount({ frames: 4, seconds: 0.4, blend: 0.5 }, 'infinite', true)
  t.mock.timers.tick(1000)
  assert.equal(view.base.style.backgroundPosition, '0% 0px')
  await view.unmount()
})

mock.reset()
