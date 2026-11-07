// 운비서 그림 움직임 — 쉴 때 멈춘 그림, 말하는 동안 웃음·움직임 가 차례로 반복, 글로만 답하면 두 번,
// 듣는 동안 깜빡임, 입력하는 동안 움직임 나(1초 쉬면 멈춤).
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

/** @typedef {{ speaking: boolean, answer: unknown, busy: boolean, listening: boolean, text: string }} Watched */

/** @type {Watched} */
const idle = { speaking: false, answer: null, busy: false, listening: false, text: '' }

/** @param {Partial<Watched>} [first] */
async function mount(first = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  let current = { ...idle, ...first }
  /** @param {Partial<Watched>} change */
  const show = (change) => {
    current = { ...current, ...change }
    const { listening, ...rest } = current
    return act(async () => { root.render(React.createElement(UnbiseoAvatar, { assistant: { ...rest, speech: { listening } }, width: 52, height: 42 })) })
  }
  await show({})
  const strip = () => /** @type {HTMLImageElement | null} */ (container.querySelector('.unbiseo-avatar-strip'))
  const motion = () => {
    const found = strip()
    if (!found) return null
    return { file: found.getAttribute('src')?.split('/').pop(), loops: found.style.getPropertyValue('--motion-loops') }
  }
  const finish = () => act(async () => { strip()?.dispatchEvent(new window.Event('animationend', { bubbles: true })) })
  return { container, show, motion, finish, unmount: () => act(async () => { root.unmount() }) }
}

const wait = (/** @type {number} */ ms) => act(async () => { await new Promise((resolve) => { setTimeout(resolve, ms) }) })

test('쉴 때는 깜빡임 첫 칸 그림만 보이고 동작 그림은 없다', async () => {
  const view = await mount()
  const still = view.container.querySelector('.unbiseo-avatar > img')
  assert.match(still?.getAttribute('src') ?? '', /unbiseo-still.png$/)
  assert.equal(view.motion(), null)
  assert.ok(!view.container.querySelector('.unbiseo-avatar.moving'))
  await view.unmount()
})

test('소리 내 말하는 동안 웃음을 계속 반복하고, 말이 끝나면 멈춘 그림으로', async () => {
  const view = await mount()
  const answer = { sentence: '오늘 매출은 30만 원이에요.' }
  // 마이크로 물으면 답과 말하기가 같이 바뀐다 — 두 번 짜리가 아니라 계속.
  await view.show({ speaking: true, answer })
  assert.deepEqual(view.motion(), { file: 'unbiseo-smile.webp', loops: 'infinite' })
  assert.ok(view.container.querySelector('.unbiseo-avatar.moving'))
  await view.show({ speaking: false })
  assert.equal(view.motion(), null)
  await view.unmount()
})

test('글로만 답이 오면 다음 동작을 두 번 하고, 다 하면 멈춘 그림으로', async () => {
  const view = await mount()
  await view.show({ answer: { sentence: '알아듣는 중…' }, busy: true })
  assert.equal(view.motion(), null, '기다리는 중에는 안 움직임')
  await view.show({ answer: { sentence: '등록했어요.' }, busy: false })
  assert.deepEqual(view.motion(), { file: 'unbiseo-smile.webp', loops: '2' })
  await view.finish()
  assert.equal(view.motion(), null)
  await view.unmount()
})

test('말할 때 동작은 웃음 → 움직임 가 → 웃음 차례, 그림을 새로 띄워도 이어서 센다', async () => {
  let view = await mount()
  const files = []
  for (let turn = 0; turn < 2; turn += 1) {
    await view.show({ speaking: true })
    files.push(view.motion()?.file)
    await view.show({ speaking: false })
  }
  await view.unmount()
  view = await mount()
  await view.show({ answer: { turn: 1 } })
  files.push(view.motion()?.file)
  await view.unmount()
  assert.deepEqual(files, ['unbiseo-smile.webp', 'unbiseo-move-a.webp', 'unbiseo-smile.webp'])
})

test('말하는 중에 그림이 새로 뜨면(카드를 펼치면) 바로 움직인다', async () => {
  const view = await mount({ speaking: true })
  assert.deepEqual(view.motion(), { file: 'unbiseo-smile.webp', loops: 'infinite' })
  await view.unmount()
})

test('듣는 동안 깜빡임을 계속 반복하고, 듣기가 끝나면 멈춘다', async () => {
  const view = await mount()
  await view.show({ listening: true })
  assert.deepEqual(view.motion(), { file: 'unbiseo-blink.webp', loops: 'infinite' })
  await view.show({ listening: false })
  assert.equal(view.motion(), null)
  await view.unmount()
})

test('글자를 치는 동안 움직임 나를 반복하고, 1초 쉬거나 칸을 비우면 멈춘다', async () => {
  const view = await mount()
  await view.show({ text: '오' })
  assert.deepEqual(view.motion(), { file: 'unbiseo-move-b.webp', loops: 'infinite' })
  await wait(600)
  await view.show({ text: '오늘' })
  await wait(600)
  assert.equal(view.motion()?.file, 'unbiseo-move-b.webp', '계속 치면 1초가 다시 시작')
  await wait(500)
  assert.equal(view.motion(), null, '마지막으로 친 뒤 1초')
  await view.show({ text: '오늘 매' })
  await view.show({ text: '' })
  assert.equal(view.motion(), null, '칸을 비우면 바로')
  await view.unmount()
})

test('마이크로 들은 말이 칸에 들어가는 것은 입력으로 치지 않는다', async () => {
  const view = await mount({ listening: true })
  await view.show({ listening: false, text: '오늘 매출', busy: true })
  assert.equal(view.motion(), null)
  await view.unmount()
})

test('겹치면 운비서 말하기 > 듣기 > 입력', async () => {
  const view = await mount()
  await view.show({ text: '오늘' })
  await view.show({ listening: true })
  assert.equal(view.motion()?.file, 'unbiseo-blink.webp', '듣기가 입력보다 먼저')
  await view.show({ speaking: true })
  assert.equal(view.motion()?.file, 'unbiseo-smile.webp', '말하기가 듣기보다 먼저')
  await view.unmount()
})
