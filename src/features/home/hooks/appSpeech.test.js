// 앱(Capacitor C-4) 운비서 음성 — 받아쓰기는 안드로이드 받아쓰기, 읽기는 xAI 못 받으면 안드로이드 목소리.
import '../../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

/** @type {'granted'|'denied'} */
let permission = 'granted'
/** @type {() => Promise<{ matches?: Array<string> }>} */
let listen = async () => ({ matches: ['오늘 수원에서 화성 15만원'] })
/** @type {Array<string>} */
const calls = []
/** @type {Array<{ text: string, lang: string }>} */
const spoken = []
let speakHangs = false

mock.module('@capacitor/core', { namedExports: { Capacitor: { isNativePlatform: () => true } } })
mock.module('@capgo/capacitor-speech-recognition', {
  namedExports: {
    SpeechRecognition: {
      requestPermissions: async () => { calls.push('permission'); return { speechRecognition: permission } },
      start: async (/** @type {{ language: string }} */ options) => { calls.push(`start:${options.language}`); return listen() },
      stop: async () => { calls.push('stop') },
    },
  },
})
mock.module('@capacitor-community/text-to-speech', {
  namedExports: {
    TextToSpeech: {
      speak: async (/** @type {{ text: string, lang: string }} */ options) => {
        spoken.push(options)
        if (speakHangs) await new Promise(() => {})
      },
      stop: async () => { calls.push('speak-stop') },
    },
  },
})
mock.module('../api/unbiseoVoice.ts', { namedExports: { requestUnbiseoVoice: async () => null } })

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: useSpeechInput, MIC_DENIED, NO_SPEECH, SPEECH_FAILED } = await import('./useSpeechInput.ts')
const { default: useSpeechOutput } = await import('./useSpeechOutput.ts')

const flush = () => new Promise((resolve) => { setTimeout(resolve, 0) })

/** 플러그인을 그때 불러와서 느린 컴퓨터에서는 한 번 기다려서는 모자란다 — 조건이 맞을 때까지 최대 50번. @param {() => boolean} check */
async function waitFor(check) {
  for (let i = 0; i < 50 && !check(); i += 1) await act(async () => { await flush() })
}

function reset() {
  permission = 'granted'
  listen = async () => ({ matches: ['오늘 수원에서 화성 15만원'] })
  calls.length = 0
  spoken.length = 0
  speakHangs = false
}

/**
 * @template T
 * @param {() => T} useHook
 */
async function mount(useHook) {
  /** @type {T | undefined} */
  let value
  function Harness() {
    value = useHook()
    return null
  }
  const root = createRoot(document.createElement('div'))
  await act(async () => { root.render(React.createElement(Harness)) })
  const latest = {
    get current() {
      if (value === undefined) throw new Error('훅이 아직 그려지지 않았다')
      return value
    },
  }
  return { latest, async unmount() { await act(async () => { root.unmount() }) } }
}

test('앱: 마이크 권한을 묻고 한국어로 들은 뒤 받아쓴 글자를 넘긴다(크롬 받아쓰기가 없어도 마이크가 보임)', async () => {
  reset()
  /** @type {Array<string>} */
  const heard = []
  const view = await mount(() => useSpeechInput((text) => { heard.push(text) }))
  try {
    assert.equal(view.latest.current.supported, true)
    await act(async () => { view.latest.current.start() })
    await waitFor(() => !view.latest.current.listening)
    assert.deepEqual(calls, ['permission', 'start:ko-KR'])
    assert.deepEqual(heard, ['오늘 수원에서 화성 15만원'])
    assert.equal(view.latest.current.listening, false)
    assert.equal(view.latest.current.error, null)
  } finally { await view.unmount() }
})

test('앱: 권한 거절·못 알아들음·그 밖의 실패는 웹과 같은 안내, 글자는 안 넘김', async () => {
  reset()
  /** @type {Array<string>} */
  const heard = []
  const view = await mount(() => useSpeechInput((text) => { heard.push(text) }))
  try {
    permission = 'denied'
    await act(async () => { view.latest.current.start() })
    await waitFor(() => !view.latest.current.listening)
    assert.equal(view.latest.current.error, MIC_DENIED)
    assert.equal(calls.includes('start:ko-KR'), false)
    permission = 'granted'
    listen = async () => { throw new Error('No match') }
    await act(async () => { view.latest.current.start() })
    await waitFor(() => !view.latest.current.listening)
    assert.equal(view.latest.current.error, NO_SPEECH)
    listen = async () => ({ matches: [] })
    await act(async () => { view.latest.current.start() })
    await waitFor(() => !view.latest.current.listening)
    assert.equal(view.latest.current.error, NO_SPEECH)
    listen = async () => { throw new Error('Network error') }
    await act(async () => { view.latest.current.start() })
    await waitFor(() => !view.latest.current.listening)
    assert.equal(view.latest.current.error, SPEECH_FAILED)
    assert.deepEqual(heard, [])
  } finally { await view.unmount() }
})

test('앱: 듣는 중 멈추기는 안드로이드 받아쓰기를 멈추고, 화면이 사라진 뒤 온 결과는 버린다', async () => {
  reset()
  /** @type {(value: { matches: Array<string> }) => void} */
  let finish = () => {}
  listen = () => new Promise((resolve) => { finish = resolve })
  /** @type {Array<string>} */
  const heard = []
  const view = await mount(() => useSpeechInput((text) => { heard.push(text) }))
  await act(async () => { view.latest.current.start(); await flush() })
  assert.equal(view.latest.current.listening, true)
  // 듣기가 실제로 시작된 뒤에 멈춘다(권한 묻기를 거쳐 늦게 닿는다).
  await waitFor(() => calls.includes('start:ko-KR'))
  await act(async () => { view.latest.current.stop() })
  await waitFor(() => calls.at(-1) === 'stop')
  assert.equal(calls.at(-1), 'stop')
  await view.unmount()
  finish({ matches: ['늦게 온 말'] })
  await waitFor(() => heard.length > 0)
  assert.deepEqual(heard, [])
})

test('앱: xAI 소리를 못 받으면 안드로이드 목소리로 한국어 한 번, 끝나면 읽는 중이 꺼지고 멈추기는 안드로이드 목소리를 멈춘다', async () => {
  reset()
  const view = await mount(() => useSpeechOutput())
  try {
    assert.equal(view.latest.current.supported, true)
    await act(async () => { view.latest.current.speak('10월 매출은 0원입니다.') })
    await waitFor(() => !view.latest.current.speaking)
    assert.deepEqual(spoken, [{ text: '10월 매출은 0원입니다.', lang: 'ko-KR' }])
    assert.equal(view.latest.current.speaking, false)
    speakHangs = true
    await act(async () => { view.latest.current.speak('다시 읽기') })
    await waitFor(() => spoken.length === 2)
    assert.equal(view.latest.current.speaking, true)
    await act(async () => { view.latest.current.stop() })
    await waitFor(() => calls.at(-1) === 'speak-stop')
    assert.equal(view.latest.current.speaking, false)
    assert.equal(calls.at(-1), 'speak-stop')
  } finally { await view.unmount() }
})
