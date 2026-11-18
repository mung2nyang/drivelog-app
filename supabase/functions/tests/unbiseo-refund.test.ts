import assert from 'node:assert/strict'
import { handleRequest as parse } from '../unbiseo-parse/handler.ts'
import { handleRequest as voice } from '../unbiseo-voice/handler.ts'
import { handleRequest as weather } from '../unbiseo-weather/handler.ts'
import { kstDate } from '../unbiseo-weather/kma.ts'
import { callWith, LIMIT_URL, post, REFUND_URL, USER_ID, USER_URL } from './fakes.ts'
import type { Answer } from './fakes.ts'

const CHAT_URL = 'https://api.x.ai/v1/chat/completions'
const TTS_URL = 'https://api.x.ai/v1/tts'
const KMA_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'
const PARSE_BODY = { text: '어제 수원 화성 15만', today: '2026-11-02', clientNames: [], routeNames: [] }
const CALL = JSON.stringify({ kind: 'call', date: '2026-11-01', loadLoc: '수원', unloadLoc: '화성', fare: 150000, client: null })
const VOICE_BODY = { text: '오늘 매출은 30만 원이에요.' }
const TOMORROW = kstDate(Date.now(), 1)
const WEATHER_BODY = { date: TOMORROW, place: '평택' }
const USED_UP = { error: '오늘 운비서를 20번 모두 썼어요. 내일 다시 써 주세요.', limit: 20 }
const failing: Answer = () => new Response('busy', { status: 500 })

function chat(content: string): Answer {
  return () => Response.json({ choices: [{ finish_reason: 'stop', message: { content } }], usage: { completion_tokens: 10 } })
}

function kma(): Answer {
  const day = TOMORROW.replaceAll('-', '')
  const item = [['TMP', '8'], ['TMP', '15'], ['SKY', '1']].map(([category, fcstValue]) => ({ category, fcstDate: day, fcstTime: '1200', fcstValue }))
  return () => Response.json({ response: { header: { resultCode: '00' }, body: { items: { item } } } })
}

function refundOf(requests: Array<Request>): Request | undefined {
  return requests.find((request) => request.url.startsWith(REFUND_URL))
}

Deno.test('말 읽기 AI 실패: 503, 관리자 열쇠로 그 회원의 말 읽기 1회를 돌려줌', async () => {
  const { response, urls, requests } = await callWith(parse, post(PARSE_BODY), { [CHAT_URL]: failing })
  assert.equal(response.status, 503)
  assert.deepEqual(urls, [USER_URL, LIMIT_URL, CHAT_URL, REFUND_URL])
  const refund = refundOf(requests)
  assert.equal(refund?.headers.get('Authorization'), 'Bearer fake-service-key')
  assert.equal(refund?.headers.get('apikey'), 'fake-service-key')
  assert.deepEqual(await refund?.json(), { p_user: USER_ID, p_kind: 'parse', p_miss: false })
})

Deno.test('말 읽기 못 알아들음: 502, 못 알아들음으로 돌려달라고 함', async () => {
  const { response, urls, requests } = await callWith(parse, post(PARSE_BODY), { [CHAT_URL]: chat('운행입니다') })
  assert.equal(response.status, 502)
  assert.deepEqual(urls, [USER_URL, LIMIT_URL, CHAT_URL, REFUND_URL])
  assert.deepEqual(await refundOf(requests)?.json(), { p_user: USER_ID, p_kind: 'parse', p_miss: true })
})

Deno.test('말 읽기 성공·한도 넘음·셀 수 없음: 돌려주지 않음', async () => {
  const runs = [
    await callWith(parse, post(PARSE_BODY), { [CHAT_URL]: chat(CALL) }),
    await callWith(parse, post(PARSE_BODY), { [LIMIT_URL]: () => Response.json(false), [CHAT_URL]: chat(CALL) }),
    await callWith(parse, post(PARSE_BODY), { [LIMIT_URL]: () => Response.json(null), [CHAT_URL]: chat(CALL) }),
  ]
  assert.deepEqual(runs.map((run) => run.response.status), [200, 429, 503])
  for (const run of runs) assert.ok(!run.urls.includes(REFUND_URL))
})

Deno.test('돌려주기가 실패하거나 관리자 열쇠가 없어도 답은 그대로, 기록에 이유만', async () => {
  const broken = await callWith(parse, post(PARSE_BODY), { [CHAT_URL]: failing, [REFUND_URL]: () => Response.json({ message: 'down' }, { status: 500 }) })
  assert.equal(broken.response.status, 503)
  assert.deepEqual(await broken.response.json(), { error: '잠시 뒤 다시 시도해 주세요.' })
  assert.ok(broken.logs.includes('give_back_failed'))
  const noKey = await callWith(parse, post(PARSE_BODY), { [CHAT_URL]: failing }, { SUPABASE_SERVICE_ROLE_KEY: null })
  assert.equal(noKey.response.status, 503)
  assert.ok(!noKey.urls.includes(REFUND_URL))
  assert.ok(noKey.logs.includes('give_back_failed no_key'))
})

Deno.test('관리자 열쇠는 새 열쇠 목록(SUPABASE_SECRET_KEYS)의 기본 열쇠도 씀', async () => {
  const env = { SUPABASE_SERVICE_ROLE_KEY: null, SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'fake-new-secret' }) }
  const { requests } = await callWith(parse, post(PARSE_BODY), { [CHAT_URL]: failing }, env)
  assert.equal(refundOf(requests)?.headers.get('apikey'), 'fake-new-secret')
})

Deno.test('목소리 만들기 실패: 503, 목소리 1회를 돌려줌 / 성공은 안 돌려줌', async () => {
  const failed = await callWith(voice, post(VOICE_BODY), { [TTS_URL]: failing })
  assert.equal(failed.response.status, 503)
  assert.deepEqual(failed.urls, [USER_URL, LIMIT_URL, TTS_URL, REFUND_URL])
  assert.deepEqual(await refundOf(failed.requests)?.json(), { p_user: USER_ID, p_kind: 'voice', p_miss: false })
  const ok = await callWith(voice, post(VOICE_BODY), { [TTS_URL]: () => new Response(new Uint8Array([1])) })
  assert.equal(ok.response.status, 200)
  assert.ok(!ok.urls.includes(REFUND_URL))
})

Deno.test('날씨: 기상청을 부르기 전에 오늘 날씨 1회를 셈(한도는 안 보냄)', async () => {
  const { response, urls, requests } = await callWith(weather, post(WEATHER_BODY), { [KMA_URL]: kma() })
  assert.equal(response.status, 200)
  assert.deepEqual(urls, [USER_URL, LIMIT_URL, KMA_URL])
  assert.equal(requests[1].headers.get('Authorization'), 'Bearer fake-user-token')
  assert.deepEqual(await requests[1].json(), { p_kind: 'weather' })
})

Deno.test('날씨 한도 넘음: 429와 운비서 문구·한도, 기상청을 안 부름', async () => {
  const { response, urls } = await callWith(weather, post(WEATHER_BODY), { [LIMIT_URL]: () => Response.json(false), [KMA_URL]: kma() })
  assert.equal(response.status, 429)
  assert.deepEqual(await response.json(), USED_UP)
  assert.deepEqual(urls, [USER_URL, LIMIT_URL])
})

Deno.test('날씨 셀 수 없음: 503 잠시 뒤, 기상청을 안 부름', async () => {
  for (const answer of [() => Response.json({ code: 'P0001' }, { status: 500 }), () => Response.json(null)]) {
    const { response, urls, logs } = await callWith(weather, post(WEATHER_BODY), { [LIMIT_URL]: answer, [KMA_URL]: kma() })
    assert.equal(response.status, 503)
    assert.deepEqual(urls, [USER_URL, LIMIT_URL])
    assert.ok(logs.includes('count_failed'))
  }
})

Deno.test('날씨 기상청 실패: 503, 날씨 1회를 돌려줌', async () => {
  const { response, urls, requests } = await callWith(weather, post(WEATHER_BODY), { [KMA_URL]: failing })
  assert.equal(response.status, 503)
  assert.deepEqual(urls, [USER_URL, LIMIT_URL, KMA_URL, REFUND_URL])
  assert.deepEqual(await refundOf(requests)?.json(), { p_user: USER_ID, p_kind: 'weather', p_miss: false })
})
