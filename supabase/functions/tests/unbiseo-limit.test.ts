// 운비서 하루 횟수 시험: 말 읽기는 AI를 부르기 전에 1회 세고, 넘었거나 셀 수 없으면 AI를 안 부른다. CI에서 deno test로 돈다.
import assert from 'node:assert/strict'
import { handleRequest as parse } from '../unbiseo-parse/handler.ts'
import { callWith, LIMIT_URL, post, TOKEN, USER_URL } from './fakes.ts'
import type { Answer } from './fakes.ts'

const CHAT_URL = 'https://api.x.ai/v1/chat/completions'
const PARSE_BODY = { text: '어제 수원 화성 15만', today: '2026-11-02', clientNames: [], routeNames: [] }
const CALL = JSON.stringify({ kind: 'call', date: '2026-11-01', loadLoc: '수원', unloadLoc: '화성', fare: 150000, client: null })
const chat: Answer = () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: CALL } }], usage: { completion_tokens: 10 } })

Deno.test('한도 안: 로그인 표로 오늘 말 읽기 1회(한도 20)를 센 뒤 AI를 불러 200', async () => {
  const { response, urls, requests } = await callWith(parse, post(PARSE_BODY), { [LIMIT_URL]: () => Response.json(true), [CHAT_URL]: chat })
  assert.equal(response.status, 200)
  assert.deepEqual(urls, [USER_URL, LIMIT_URL, CHAT_URL])
  assert.equal(requests[1].method, 'POST')
  assert.equal(requests[1].headers.get('Authorization'), `Bearer ${TOKEN}`)
  assert.equal(requests[1].headers.get('apikey'), 'fake-anon-key')
  assert.deepEqual(await requests[1].json(), { p_kind: 'parse', p_limit: 20 })
})

Deno.test('한도 넘음: 429와 문구·한도, AI를 안 부름', async () => {
  const { response, urls } = await callWith(parse, post(PARSE_BODY), { [LIMIT_URL]: () => Response.json(false), [CHAT_URL]: chat })
  assert.equal(response.status, 429)
  assert.deepEqual(await response.json(), { error: '오늘 운비서를 20번 모두 썼어요. 내일 다시 써 주세요.', limit: 20 })
  assert.deepEqual(urls, [USER_URL, LIMIT_URL])
})

Deno.test('셀 수 없음(서버 500·연결 끊김·참거짓 아닌 답): 503 잠시 뒤, AI를 안 부름', async () => {
  const answers: Array<Answer> = [
    () => Response.json({ code: 'P0001', message: 'busy' }, { status: 500 }),
    () => { throw new TypeError('끊김') },
    () => Response.json(null),
  ]
  for (const answer of answers) {
    const { response, urls, logs } = await callWith(parse, post(PARSE_BODY), { [LIMIT_URL]: answer, [CHAT_URL]: chat })
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: '잠시 뒤 다시 시도해 주세요.' })
    assert.deepEqual(urls, [USER_URL, LIMIT_URL])
    assert.ok(logs.includes('count_failed'))
  }
})

Deno.test('로그인 실패·입력이 틀리면 세지 않음', async () => {
  for (const request of [post(PARSE_BODY, 'wrong-token'), post({ ...PARSE_BODY, text: '' })]) {
    const { response, urls } = await callWith(parse, request, { [CHAT_URL]: chat })
    assert.ok(response.status === 401 || response.status === 400)
    assert.ok(!urls.includes(LIMIT_URL))
  }
})
