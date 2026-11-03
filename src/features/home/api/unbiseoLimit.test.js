// @ts-check
// 운비서 하루 횟수를 다 썼을 때(429): 서버가 실어 보낸 한도로 문구, 못 읽으면 숫자 없이.
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { FunctionsHttpError } from '@supabase/supabase-js'

/** @type {() => Promise<{ data: null, error: Error }>} */
let reply = async () => ({ data: null, error: new Error('unset') })

mock.module('../../../data/cloud/supabaseClient.ts', {
  namedExports: { supabase: { functions: { invoke: async () => reply() } } },
})

const { requestUnbiseoParse, TRY_LATER, USED_UP } = await import('./unbiseoParse.ts')

/** @param {string} body @param {number} [status] */
async function messageFor(body, status = 429) {
  reply = async () => ({ data: null, error: new FunctionsHttpError(new Response(body, { status })) })
  const result = await requestUnbiseoParse({ text: '평택 용인', today: '2026-11-03', clientNames: [] })
  assert.equal(result.kind, 'error')
  return result.kind === 'error' ? result.message : ''
}

test('429: 서버가 보낸 한도로 "오늘 운비서를 20번 모두 썼어요. 내일 다시 써 주세요."', async () => {
  const body = JSON.stringify({ error: '오늘 운비서를 20번 모두 썼어요. 내일 다시 써 주세요.', limit: 20 })
  assert.equal(await messageFor(body), '오늘 운비서를 20번 모두 썼어요. 내일 다시 써 주세요.')
})

test('429인데 한도를 못 읽으면(칸 없음·0·소수·JSON 아님) 숫자 없는 문구', async () => {
  for (const body of ['{}', '{"limit":0}', '{"limit":2.5}', '{"limit":"20"}', 'busy']) {
    assert.equal(await messageFor(body), USED_UP, body)
  }
})

test('429가 아니면 그대로 잠시 뒤', async () => {
  assert.equal(await messageFor('{"limit":20}', 503), TRY_LATER)
})
