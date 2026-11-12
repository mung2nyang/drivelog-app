import assert from 'node:assert/strict'
import { callWith } from './fakes.ts'
import type { Answer } from './fakes.ts'
import { forgetAccessToken } from '../send-push/fcm.ts'
import { handleRequest, readInput } from '../send-push/handler.ts'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const SECRET = 'fake-push-secret'
const REST = 'https://fake.supabase.test/rest/v1'
const FCM = 'https://fcm.googleapis.com/v1/projects/fake-project/messages:send'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'

const PAIR = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'],
)
const DER = new Uint8Array(await crypto.subtle.exportKey('pkcs8', PAIR.privateKey))
const PEM = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...DER))}\n-----END PRIVATE KEY-----\n`
const EMAIL = 'push@fake-project.iam.gserviceaccount.com'
const ACCOUNT = JSON.stringify({ project_id: 'fake-project', client_email: EMAIL, private_key: PEM })

const unbase64url = (part: string) => Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function googleToken(request: Request): Promise<Response> {
  const form = new URLSearchParams(await request.text())
  const [head, claims, signature] = (form.get('assertion') || '').split('.')
  const ok = form.get('grant_type') === 'urn:ietf:params:oauth:grant-type:jwt-bearer' && !!signature
    && await crypto.subtle.verify('RSASSA-PKCS1-v1_5', PAIR.publicKey, unbase64url(signature), new TextEncoder().encode(`${head}.${claims}`))
  const body = ok ? JSON.parse(new TextDecoder().decode(unbase64url(claims))) : null
  const valid = body && body.iss === EMAIL && body.aud === GOOGLE_TOKEN && body.scope === 'https://www.googleapis.com/auth/firebase.messaging' && body.exp - body.iat === 3600
  return valid ? Response.json({ access_token: 'fake-google-token', expires_in: 3600 }) : Response.json({ error: 'invalid_grant' }, { status: 400 })
}
const ENV = { PUSH_SECRET: SECRET, SUPABASE_SERVICE_ROLE_KEY: 'fake-service-key', SUPABASE_SECRET_KEYS: null, FIREBASE_SERVICE_ACCOUNT: ACCOUNT }

function trigger(body: object | string, secret: string | null = SECRET): Request {
  const headers: { [name: string]: string } = { 'Content-Type': 'application/json' }
  if (secret) headers['x-push-secret'] = secret
  return new Request('https://fn.test/', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
}

type World = { settings: { [id: string]: object }, devices: Array<{ token: string, user_id: string }>, gone: Array<string> }

function fakes(world: World) {
  const deleted: Array<string> = []
  const sent: Array<{ token: string, body: string }> = []
  const inList = (url: URL, name: string) => (url.searchParams.get(name) || '').replace(/^in\.\(|\)$/g, '').split(',').map((v) => v.replace(/"/g, ''))
  const answers: { [url: string]: Answer } = {
    [`${REST}/profiles`]: (request) => {
      const ids = inList(new URL(request.url), 'id')
      return Response.json(ids.filter((id) => world.settings[id]).map((id) => ({ id, settings: world.settings[id] })))
    },
    [`${REST}/push_devices`]: (request) => {
      const url = new URL(request.url)
      if (request.method === 'DELETE') {
        deleted.push(...inList(url, 'token'))
        return new Response(null, { status: 204 })
      }
      const users = inList(url, 'user_id')
      return Response.json(world.devices.filter((d) => users.includes(d.user_id)).map(({ token }) => ({ token })))
    },
    [GOOGLE_TOKEN]: googleToken,
    [FCM]: async (request) => {
      if (request.headers.get('Authorization') !== 'Bearer fake-google-token') return Response.json({}, { status: 401 })
      const body = await request.text()
      const token = JSON.parse(body).message.token
      sent.push({ token, body })
      return world.gone.includes(token)
        ? Response.json({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }, { status: 404 })
        : Response.json({ name: 'projects/fake-project/messages/1' })
    },
  }
  return { answers, deleted, sent }
}

Deno.test('보내기 암호가 없거나 틀리면 거절, 바깥은 안 부름', async () => {
  for (const secret of [null, 'wrong']) {
    const { answers } = fakes({ settings: {}, devices: [], gone: [] })
    const { response, urls } = await callWith(handleRequest, trigger({ kind: 'inquiryAnswer', userIds: [A] }, secret), answers, ENV)
    assert.equal(response.status, 401)
    assert.deepEqual(urls, [])
  }
})

Deno.test('모양: 모르는 종류·id 아님·너무 많음은 null, 같은 id는 하나로', () => {
  assert.equal(readInput({ kind: 'other', userIds: [A] }), null)
  assert.equal(readInput({ kind: 'inquiryAnswer', userIds: ['not-a-uuid'] }), null)
  assert.equal(readInput({ kind: 'inquiryAnswer', userIds: Array.from({ length: 51 }, () => A) }), null)
  assert.deepEqual(readInput({ kind: 'adminInquiry', userIds: [A, A, B] }), { kind: 'adminInquiry', userIds: [A, B] })
})

Deno.test('받는 사람 기기마다 보내고, 글에는 정해진 문구와 화면 주소만', async () => {
  forgetAccessToken()
  const world = { settings: { [A]: {}, [B]: {} }, devices: [{ token: 'tok-a1', user_id: A }, { token: 'tok-a2', user_id: A }, { token: 'tok-b', user_id: B }], gone: [] }
  const { answers, sent } = fakes(world)
  const { response, logs } = await callWith(handleRequest, trigger({ kind: 'inquiryAnswer', userIds: [A] }), answers, ENV)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { sent: 2, gone: 0, failed: 0 })
  assert.deepEqual(sent.map((s) => s.token).sort(), ['tok-a1', 'tok-a2'])
  const message = JSON.parse(sent[0].body).message
  assert.deepEqual(message.notification, { title: '문의에 답변이 도착했습니다', body: '고객센터 나의 문의에서 확인해 주세요.' })
  assert.deepEqual(message.data, { path: '/app/support?tab=my' })
  assert.ok(!logs.includes('tok-a1'), '기록에 기기 주소 없음')
})

Deno.test('"알림 받기"에서 끈 사람은 빼고, 기사 연결은 "기사 초대 대기" 스위치를 봄', async () => {
  forgetAccessToken()
  const world = { settings: { [A]: { notifOff: ['driverInvite'] }, [B]: { notifOff: ['inquiryAnswer'] } }, devices: [{ token: 'tok-a', user_id: A }, { token: 'tok-b', user_id: B }], gone: [] }
  const linked = fakes(world)
  const first = await callWith(handleRequest, trigger({ kind: 'driverLinked', userIds: [A, B] }), linked.answers, ENV)
  assert.deepEqual(await first.response.json(), { sent: 1, gone: 0, failed: 0 })
  assert.deepEqual(linked.sent.map((s) => s.token), ['tok-b'])
  assert.equal(JSON.parse(linked.sent[0].body).message.data.path, '/app/drivers')
  const off = fakes(world)
  const second = await callWith(handleRequest, trigger({ kind: 'driverLinked', userIds: [A] }), off.answers, ENV)
  assert.deepEqual(await second.response.json(), { sent: 0, gone: 0, failed: 0 })
  assert.ok(!second.urls.includes(GOOGLE_TOKEN), '보낼 사람이 없으면 구글을 안 부름')
})

Deno.test('구글이 없는 주소라 하면 그 줄만 지운다', async () => {
  forgetAccessToken()
  const world = { settings: { [A]: {} }, devices: [{ token: 'tok-old', user_id: A }, { token: 'tok-new', user_id: A }], gone: ['tok-old'] }
  const { answers, deleted } = fakes(world)
  const { response } = await callWith(handleRequest, trigger({ kind: 'adminInquiry', userIds: [A] }), answers, ENV)
  assert.deepEqual(await response.json(), { sent: 1, gone: 1, failed: 0 })
  assert.deepEqual(deleted, ['tok-old'])
})

Deno.test('서비스 계정 열쇠가 없으면 500, 구글은 안 부름', async () => {
  const { answers } = fakes({ settings: { [A]: {} }, devices: [{ token: 'tok', user_id: A }], gone: [] })
  const { response, urls } = await callWith(handleRequest, trigger({ kind: 'adminInquiry', userIds: [A] }), answers, { ...ENV, FIREBASE_SERVICE_ACCOUNT: null })
  assert.equal(response.status, 500)
  assert.ok(!urls.includes(FCM))
})
