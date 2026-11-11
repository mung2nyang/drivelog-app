// 운비서 상황 고르기 — 쉴 때, 소리 내 말하는 동안 답하는 중, 글로만 답하면 답하는 중 두 바퀴,
// 듣는 동안 듣는 중, 입력하는 동안 입력 중(1초 쉬면 끝). 겹치면 말하기 > 듣기 > 글 답 > 입력.
import '../../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: useUnbiseoMotion } = await import('./useUnbiseoMotion.ts')

/** @typedef {import('./useUnbiseoAssistant.ts').UnbiseoAnswer} UnbiseoAnswer */
/** @typedef {{ speaking: boolean, answer: UnbiseoAnswer | null, busy: boolean, listening: boolean, text: string }} Watched */

/** 문장만 있는 답. @param {string} sentence @returns {UnbiseoAnswer} */
const said = (sentence) => ({ said: '', sentence, call: null, expense: null, fixed: null, client: null, sms: null, inspection: null, dayOff: null })

/** @type {Watched} */
const idle = { speaking: false, answer: null, busy: false, listening: false, text: '' }

/** @param {Partial<Watched>} [first] */
async function mount(first = {}) {
  /** @type {ReturnType<typeof useUnbiseoMotion> | undefined} */
  let value
  let watched = { ...idle, ...first }
  function Harness() {
    value = useUnbiseoMotion(watched)
    return null
  }
  const latest = {
    get current() {
      if (value === undefined) throw new Error('훅이 아직 그려지지 않았다')
      return value
    },
  }
  const root = createRoot(document.createElement('div'))
  /** @param {Partial<Watched>} change */
  const show = (change) => {
    watched = { ...watched, ...change }
    return act(async () => { root.render(React.createElement(Harness)) })
  }
  await show({})
  const motion = () => {
    const { situation, loops } = latest.current.motion
    return { situation, loops }
  }
  return { show, motion, latest, done: () => act(async () => { latest.current.done() }), unmount: () => act(async () => { root.unmount() }) }
}

const wait = (/** @type {number} */ ms) => act(async () => { await new Promise((resolve) => { setTimeout(resolve, ms) }) })

test('아무 일 없으면 쉴 때 그림을 계속 넘긴다', async () => {
  const view = await mount()
  assert.deepEqual(view.motion(), { situation: 'rest', loops: 'infinite' })
  await view.unmount()
})

test('소리 내 말하는 동안 답하는 중을 계속, 말이 끝나면 쉴 때로', async () => {
  const view = await mount()
  // 마이크로 물으면 답과 말하기가 같이 바뀐다 — 두 바퀴 짜리가 아니라 계속.
  await view.show({ speaking: true, answer: said('오늘 매출은 30만 원이에요.') })
  assert.deepEqual(view.motion(), { situation: 'talk', loops: 'infinite' })
  await view.show({ speaking: false })
  assert.deepEqual(view.motion(), { situation: 'rest', loops: 'infinite' })
  await view.unmount()
})

test('글로만 답이 오면 답하는 중을 두 바퀴, 다 돌면 쉴 때로. 다음 답은 처음 칸부터 다시', async () => {
  const view = await mount()
  await view.show({ answer: said('알아듣는 중…'), busy: true })
  assert.equal(view.motion().situation, 'rest', '기다리는 중에는 쉴 때')
  await view.show({ answer: said('등록했어요.'), busy: false })
  assert.deepEqual(view.motion(), { situation: 'talk', loops: 2 })
  const firstKey = view.latest.current.motion.key
  await view.done()
  assert.equal(view.motion().situation, 'rest')
  await view.show({ answer: said('또 등록했어요.') })
  assert.notEqual(view.latest.current.motion.key, firstKey)
  await view.unmount()
})

test('듣는 동안 듣는 중을 계속, 듣기가 끝나면 쉴 때로', async () => {
  const view = await mount()
  await view.show({ listening: true })
  assert.deepEqual(view.motion(), { situation: 'listen', loops: 'infinite' })
  await view.show({ listening: false })
  assert.equal(view.motion().situation, 'rest')
  await view.unmount()
})

test('글자를 치는 동안 입력 중, 1초 쉬거나 칸을 비우면 쉴 때로', async () => {
  const view = await mount()
  await view.show({ text: '오' })
  assert.deepEqual(view.motion(), { situation: 'type', loops: 'infinite' })
  await wait(600)
  await view.show({ text: '오늘' })
  await wait(600)
  assert.equal(view.motion().situation, 'type', '계속 치면 1초가 다시 시작')
  await wait(500)
  assert.equal(view.motion().situation, 'rest', '마지막으로 친 뒤 1초')
  await view.show({ text: '오늘 매' })
  await view.show({ text: '' })
  assert.equal(view.motion().situation, 'rest', '칸을 비우면 바로')
  await view.unmount()
})

test('마이크로 들은 말이 칸에 들어가는 것은 입력으로 치지 않는다', async () => {
  const view = await mount({ listening: true })
  await view.show({ listening: false, text: '오늘 매출', busy: true })
  assert.equal(view.motion().situation, 'rest')
  await view.unmount()
})

test('겹치면 말하기 > 듣기 > 입력', async () => {
  const view = await mount()
  await view.show({ text: '오늘' })
  await view.show({ listening: true })
  assert.equal(view.motion().situation, 'listen', '듣기가 입력보다 먼저')
  await view.show({ speaking: true })
  assert.equal(view.motion().situation, 'talk', '말하기가 듣기보다 먼저')
  await view.unmount()
})
