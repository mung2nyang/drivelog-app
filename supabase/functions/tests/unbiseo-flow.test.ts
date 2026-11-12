import assert from 'node:assert/strict'
import { handleRequest as parse } from '../unbiseo-parse/handler.ts'
import { handleRequest as voice } from '../unbiseo-voice/handler.ts'
import { handleRequest as weather } from '../unbiseo-weather/handler.ts'
import { kstDate } from '../unbiseo-weather/kma.ts'
import { callWith, LIMIT_URL, post, TOKEN, USER_URL } from './fakes.ts'
import type { Answer, Handler } from './fakes.ts'

const CHAT_URL = 'https://api.x.ai/v1/chat/completions'
const TTS_URL = 'https://api.x.ai/v1/tts'
const KMA_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'
const TRY_LATER = { error: '잠시 뒤 다시 시도해 주세요.' }
const TODAY = '2026-11-02'
const SAID = '어제 수원 화성 15만'
const PLACE = '평택'
const TOMORROW = kstDate(Date.now(), 1)

const PARSE_BODY = { text: SAID, today: TODAY, clientNames: ['한진'], routeNames: [] }
const VOICE_BODY = { text: '오늘 매출은 30만 원이에요.' }
const WEATHER_BODY = { date: TOMORROW, place: PLACE }
const SERVERS: Array<{ name: string, handler: Handler, body: object }> = [
  { name: '말 읽기', handler: parse, body: PARSE_BODY },
  { name: '목소리', handler: voice, body: VOICE_BODY },
  { name: '날씨', handler: weather, body: WEATHER_BODY },
]
const CALL = JSON.stringify({ kind: 'call', date: '2026-11-01', loadLoc: '수원', unloadLoc: '화성', fare: 150000, client: null })
const failing: Answer = () => new Response('busy', { status: 500 })

const flow = (name: string, fn: () => Promise<void>) => Deno.test(name, fn)

function chat(content: string, finish = 'stop'): Answer {
  return () => Response.json({ choices: [{ finish_reason: finish, message: { content } }], usage: { completion_tokens: 10 } })
}

function kma(code = '00'): Answer {
  const day = TOMORROW.replaceAll('-', '')
  const item = [['TMP', '8'], ['TMP', '15'], ['SKY', '1'], ['POP', '20']].map(([category, fcstValue]) => ({ category, fcstDate: day, fcstTime: '1200', fcstValue }))
  return () => Response.json({ response: { header: { resultCode: code }, body: { items: { item } } } })
}

for (const { name, handler, body } of SERVERS) {
  flow(`${name} 공통: OPTIONS는 ok와 CORS`, async () => {
    const { response, urls } = await callWith(handler, new Request('https://fn.test/', { method: 'OPTIONS' }))
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'ok')
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
    assert.deepEqual(urls, [])
  })

  flow(`${name} 공통: POST가 아니면 405`, async () => {
    const { response, urls } = await callWith(handler, new Request('https://fn.test/', { method: 'GET' }))
    assert.equal(response.status, 405)
    assert.deepEqual(urls, [])
  })

  flow(`${name} 공통: 로그인 머리가 없으면 401, 바깥을 안 부름`, async () => {
    const { response, urls } = await callWith(handler, post(body, null))
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: '로그인이 필요합니다.' })
    assert.deepEqual(urls, [])
  })

  flow(`${name} 공통: Supabase가 토큰을 거절하면 401, AI·기상청은 안 부름`, async () => {
    const { response, urls, requests } = await callWith(handler, post(body, 'wrong-token'))
    assert.equal(response.status, 401)
    assert.deepEqual(urls, [USER_URL])
    assert.equal(requests[0].headers.get('Authorization'), 'Bearer wrong-token')
  })

  flow(`${name} 공통: SUPABASE_URL이 없으면 401`, async () => {
    const { response, urls } = await callWith(handler, post(body), {}, { SUPABASE_URL: null })
    assert.equal(response.status, 401)
    assert.deepEqual(urls, [])
  })

  flow(`${name} 공통: 깨진 JSON·틀린 모양은 400, AI·기상청은 안 부름`, async () => {
    const wrongs: Array<object | string> = ['{', {}]
    for (const wrong of wrongs) {
      const { response, urls } = await callWith(handler, post(wrong))
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), { error: '요청 모양이 맞지 않습니다.' })
      assert.deepEqual(urls, [USER_URL])
    }
  })
}

flow('말 읽기: AI 운행 답이면 200과 운행 칸, AI에 키와 문장을 보냄', async () => {
  const { response, urls, requests } = await callWith(parse, post(PARSE_BODY), { [CHAT_URL]: chat(CALL) })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { kind: 'call', call: { date: '2026-11-01', loadLoc: '수원', unloadLoc: '화성', fare: 150000, client: '' } })
  assert.deepEqual(urls, [USER_URL, LIMIT_URL, CHAT_URL])
  assert.equal(requests[2].headers.get('Authorization'), 'Bearer fake-xai-key')
  assert.ok((await requests[2].text()).includes(SAID))
})

flow('말 읽기: 잘린 답(length)·JSON 아닌 답은 502', async () => {
  for (const answer of [chat(CALL, 'length'), chat('운행입니다')]) {
    const { response } = await callWith(parse, post(PARSE_BODY), { [CHAT_URL]: answer })
    assert.equal(response.status, 502)
    assert.deepEqual(await response.json(), { error: '알아듣지 못했습니다. 다시 말해 주세요.' })
  }
})

flow('말 읽기: AI 500·연결 실패는 503', async () => {
  const answers: Array<Answer> = [failing, () => { throw new TypeError('끊김') }]
  for (const answer of answers) {
    const { response, urls } = await callWith(parse, post(PARSE_BODY), { [CHAT_URL]: answer })
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), TRY_LATER)
    assert.deepEqual(urls, [USER_URL, LIMIT_URL, CHAT_URL])
  }
})

flow('말 읽기: AI 키가 없으면 503, AI를 안 부름', async () => {
  const { response, urls } = await callWith(parse, post(PARSE_BODY), { [CHAT_URL]: chat(CALL) }, { XAI_API_KEY: null })
  assert.equal(response.status, 503)
  assert.deepEqual(urls, [USER_URL, LIMIT_URL])
})

flow('목소리: 소리를 받으면 200 octet-stream, 같은 바이트', async () => {
  const { response, urls, requests } = await callWith(voice, post(VOICE_BODY), { [TTS_URL]: () => new Response(new Uint8Array([1, 2, 3])) })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Content-Type'), 'application/octet-stream')
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3])
  assert.deepEqual(urls, [USER_URL, LIMIT_URL, TTS_URL])
  assert.equal(requests[2].headers.get('Authorization'), 'Bearer fake-xai-key')
})

flow('목소리: AI 500·빈 소리는 503', async () => {
  for (const answer of [failing, () => new Response(new Uint8Array(0))]) {
    const { response } = await callWith(voice, post(VOICE_BODY), { [TTS_URL]: answer })
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), TRY_LATER)
  }
})

flow('목소리: AI 키가 없으면 503, AI를 안 부름', async () => {
  const { response, urls } = await callWith(voice, post(VOICE_BODY), {}, { XAI_API_KEY: null })
  assert.equal(response.status, 503)
  assert.deepEqual(urls, [USER_URL, LIMIT_URL])
})

flow('날씨: 어제는 past, 3일 뒤는 tooFar, 없는 동네는 noPlace, 기상청을 안 부름', async () => {
  const cases: Array<[object, string]> = [
    [{ date: kstDate(Date.now(), -1), place: PLACE }, 'past'],
    [{ date: kstDate(Date.now(), 3), place: PLACE }, 'tooFar'],
    [{ date: TOMORROW, place: '없는동네' }, 'noPlace'],
  ]
  for (const [body, kind] of cases) {
    const { response, urls } = await callWith(weather, post(body), { [KMA_URL]: kma() })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { kind })
    assert.deepEqual(urls, [USER_URL])
  }
})

flow('날씨: 내일 평택은 기상청에 격자 62·114로 묻고 요약을 돌려줌', async () => {
  const { response, urls, requests } = await callWith(weather, post(WEATHER_BODY), { [KMA_URL]: kma() })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { kind: 'weather', weather: { date: TOMORROW, sky: 'clear', precip: 'none', min: 8, max: 15, pop: 20 } })
  assert.deepEqual(urls, [USER_URL, KMA_URL])
  const query = new URL(requests[1].url).searchParams
  assert.deepEqual([query.get('nx'), query.get('ny'), query.get('serviceKey')], ['62', '114', 'fake-kma-key'])
})

flow('날씨: 기상청 오류 코드·500은 503', async () => {
  for (const answer of [kma('03'), failing]) {
    const { response } = await callWith(weather, post(WEATHER_BODY), { [KMA_URL]: answer })
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), TRY_LATER)
  }
})

flow('날씨: 기상청 키가 없으면 503, 기상청을 안 부름', async () => {
  const { response, urls } = await callWith(weather, post(WEATHER_BODY), {}, { KMA_API_KEY: null })
  assert.equal(response.status, 503)
  assert.deepEqual(urls, [USER_URL])
})

flow('기록: 말한 문장·지역·키·토큰은 console에 안 남김', async () => {
  const runs = [
    await callWith(parse, post(PARSE_BODY), { [CHAT_URL]: chat(CALL) }),
    await callWith(parse, post(PARSE_BODY), { [CHAT_URL]: failing }),
    await callWith(voice, post(VOICE_BODY), { [TTS_URL]: () => new Response(new Uint8Array([1])) }),
    await callWith(voice, post(VOICE_BODY), { [TTS_URL]: failing }),
    await callWith(weather, post(WEATHER_BODY), { [KMA_URL]: kma() }),
    await callWith(weather, post(WEATHER_BODY), { [KMA_URL]: kma('03') }),
  ]
  for (const run of runs) assert.ok(run.logs, '기록이 모이지 않음')
  const logs = runs.map((run) => run.logs).join('\n')
  for (const secret of [SAID, VOICE_BODY.text, PLACE, 'fake-xai-key', 'fake-kma-key', TOKEN]) {
    assert.ok(!logs.includes(secret), `기록에 남음: ${secret}`)
  }
})
