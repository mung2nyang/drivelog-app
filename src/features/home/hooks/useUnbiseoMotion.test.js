// 운비서 그림 움직임 — 쉴 때 멈춘 그림, 소리 내 말하는 동안 반복, 글로만 답하면 두 번, 동작은 차례로.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
// jsdom에는 AnimationEvent가 없어, 그대로 두면 React가 접두어 붙은 이름으로 animationend를 듣는다.
if (!('AnimationEvent' in window)) Reflect.set(window, 'AnimationEvent', window.Event)

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: UnbiseoAvatar } = await import('../ui/UnbiseoAvatar.tsx')
const { resetMotionOrder } = await import('./useUnbiseoMotion.ts')

beforeEach(() => resetMotionOrder())

/** @typedef {{ speaking: boolean, answer: unknown, busy: boolean }} Watched */

/** @param {Watched} first */
async function mount(first) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  /** @param {Watched} assistant */
  const show = (assistant) => act(async () => { root.render(React.createElement(UnbiseoAvatar, { assistant, width: 36, height: 29 })) })
  await show(first)
  const strip = () => /** @type {HTMLImageElement | null} */ (container.querySelector('.unbiseo-avatar-strip'))
  const motion = () => {
    const found = strip()
    if (!found) return null
    return { file: found.getAttribute('src')?.split('/').pop(), loops: found.style.getPropertyValue('--motion-loops') }
  }
  const finish = () => act(async () => { strip()?.dispatchEvent(new window.Event('animationend', { bubbles: true })) })
  return { container, show, motion, finish, unmount: () => act(async () => { root.unmount() }) }
}

const idle = { speaking: false, answer: null, busy: false }

test('쉴 때는 멈춘 그림만 보이고 동작 그림은 없다', async () => {
  const view = await mount(idle)
  const still = view.container.querySelector('.unbiseo-avatar > img')
  assert.match(still?.getAttribute('src') ?? '', /assistant_unbiseo\.png$/)
  assert.equal(view.motion(), null)
  assert.ok(!view.container.querySelector('.unbiseo-avatar.moving'))
  await view.unmount()
})

test('소리 내 말하는 동안 첫 동작을 계속 반복하고, 말이 끝나면 멈춘 그림으로', async () => {
  const view = await mount(idle)
  const answer = { sentence: '오늘 매출은 30만 원이에요.' }
  // 마이크로 물으면 답과 말하기가 같이 바뀐다 — 두 번 짜리가 아니라 계속.
  await view.show({ speaking: true, answer, busy: false })
  assert.deepEqual(view.motion(), { file: 'unbiseo-motion-1.webp', loops: 'infinite' })
  assert.ok(view.container.querySelector('.unbiseo-avatar.moving'))
  await view.show({ speaking: false, answer, busy: false })
  assert.equal(view.motion(), null)
  await view.unmount()
})

test('글로만 답이 오면 다음 동작을 두 번 하고, 다 하면 멈춘 그림으로', async () => {
  const view = await mount(idle)
  await view.show({ speaking: false, answer: { sentence: '알아듣는 중…' }, busy: true })
  assert.equal(view.motion(), null, '기다리는 중에는 안 움직임')
  await view.show({ speaking: false, answer: { sentence: '등록했어요.' }, busy: false })
  assert.deepEqual(view.motion(), { file: 'unbiseo-motion-1.webp', loops: '2' })
  await view.finish()
  assert.equal(view.motion(), null)
  await view.unmount()
})

test('동작은 말할 때마다 1 → 6 차례로 바뀌고 다시 1로, 그림을 새로 띄워도 이어서 센다', async () => {
  let view = await mount(idle)
  const files = []
  for (let turn = 0; turn < 4; turn += 1) {
    await view.show({ speaking: true, answer: null, busy: false })
    files.push(view.motion()?.file)
    await view.show(idle)
  }
  await view.unmount()
  view = await mount(idle)
  for (let turn = 0; turn < 3; turn += 1) {
    await view.show({ speaking: false, answer: { turn }, busy: false })
    files.push(view.motion()?.file)
    await view.finish()
  }
  await view.unmount()
  assert.deepEqual(files, [1, 2, 3, 4, 5, 6, 1].map((number) => `unbiseo-motion-${number}.webp`))
})

test('말하는 중에 그림이 새로 뜨면(카드를 펼치면) 바로 움직인다', async () => {
  const view = await mount({ speaking: true, answer: null, busy: false })
  assert.deepEqual(view.motion(), { file: 'unbiseo-motion-1.webp', loops: 'infinite' })
  await view.unmount()
})
