import { createClient } from 'npm:@supabase/supabase-js@2.112.3'
import { accessToken, readServiceAccount, sendToDevice } from './fcm.ts'
import type { Json, Message } from './fcm.ts'

type Kind = 'adminInquiry' | 'inquiryAnswer' | 'driverLinked'
type Input = { kind: Kind, userIds: Array<string> }

const MAX_USERS = 50
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KINDS: { [kind in Kind]: Message & { switchKind: string } } = {
  adminInquiry: { title: '새 문의가 도착했습니다', body: '관리자 화면에서 확인해 주세요.', path: '/app/admin/inquiries', switchKind: 'adminInquiry' },
  inquiryAnswer: { title: '문의에 답변이 도착했습니다', body: '고객센터 나의 문의에서 확인해 주세요.', path: '/app/support?tab=my', switchKind: 'inquiryAnswer' },
  driverLinked: { title: '기사가 연결했습니다', body: '기사 관리에서 확인해 주세요.', path: '/app/drivers', switchKind: 'driverInvite' },
}

function reply(status: number, body: Json): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function isKind(value: Json | undefined): value is Kind {
  return typeof value === 'string' && Object.hasOwn(KINDS, value)
}

export function readInput(body: Json): Input | null {
  const row = body && typeof body === 'object' && !Array.isArray(body) ? body : null
  const ids = row?.userIds
  if (!row || !isKind(row.kind) || !Array.isArray(ids) || ids.length > MAX_USERS) return null
  const userIds = ids.filter((id): id is string => typeof id === 'string' && UUID.test(id))
  return userIds.length === ids.length ? { kind: row.kind, userIds: [...new Set(userIds)] } : null
}

function secretKey(): string | null {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    const keys: Json = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || 'null')
    const named = keys && typeof keys === 'object' && !Array.isArray(keys) ? keys.default : null
    return typeof named === 'string' && named ? named : null
  } catch {
    return null
  }
}

function turnedOff(settings: Json | undefined, switchKind: string): boolean {
  const off = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings.notifOff : null
  return Array.isArray(off) && off.includes(switchKind)
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') return reply(405, { error: 'method' })
  const secret = Deno.env.get('PUSH_SECRET') || ''
  if (!secret || req.headers.get('x-push-secret') !== secret) return reply(401, { error: 'secret' })
  let body: Json
  try {
    body = await req.json()
  } catch {
    return reply(400, { error: 'shape' })
  }
  const input = readInput(body)
  const url = Deno.env.get('SUPABASE_URL')
  const key = secretKey()
  const account = readServiceAccount(Deno.env.get('FIREBASE_SERVICE_ACCOUNT'))
  if (!input) return reply(400, { error: 'shape' })
  if (!url || !key || !account) {
    console.error('[send-push] setup', JSON.stringify({ url: !!url, key: !!key, account: !!account }))
    return reply(500, { error: 'setup' })
  }
  const kind = KINDS[input.kind]
  const db = createClient(url, key, { auth: { persistSession: false } })
  const { data: profiles, error: profileError } = await db.from('profiles').select('id, settings').in('id', input.userIds)
  if (profileError) return reply(502, { error: 'profiles' })
  const off = new Set((profiles || []).filter((row) => turnedOff(row.settings, kind.switchKind)).map((row) => String(row.id)))
  const targets = input.userIds.filter((id) => !off.has(id))
  if (targets.length === 0) return reply(200, { sent: 0, gone: 0, failed: 0 })
  const { data: devices, error: deviceError } = await db.from('push_devices').select('token').in('user_id', targets)
  if (deviceError) return reply(502, { error: 'devices' })
  const tokens = (devices || []).map((row) => String(row.token))
  if (tokens.length === 0) return reply(200, { sent: 0, gone: 0, failed: 0 })
  let token: string
  try {
    token = await accessToken(account)
  } catch (error) {
    console.error('[send-push] google token', error instanceof Error ? error.message : 'failed')
    return reply(502, { error: 'google' })
  }
  const results = await Promise.all(tokens.map((device) => sendToDevice(account, token, device, kind)))
  const gone = tokens.filter((_, i) => results[i] === 'gone')
  if (gone.length > 0) await db.from('push_devices').delete().in('token', gone)
  const count = { sent: results.filter((r) => r === 'sent').length, gone: gone.length, failed: results.filter((r) => r === 'failed').length }
  console.log('[send-push]', JSON.stringify({ kind: input.kind, ...count }))
  return reply(200, count)
}
