import { createClient } from 'npm:@supabase/supabase-js@2.112.3'
import { AiUnavailableError, askAi } from './grok.ts'
import type { ParseInput } from './grok.ts'
import { readRouteNames } from './fixedRoute.ts'
import { isDateKey, readAiAnswer, record } from './answer.ts'
import type { Json } from './question.ts'

const TEXT_MAX = 300
const CLIENTS_MAX = 200
const CLIENT_NAME_MAX = 50
const NOT_UNDERSTOOD = '알아듣지 못했습니다. 다시 말해 주세요.'
const TRY_LATER = '잠시 뒤 다시 시도해 주세요.'
const DAILY_LIMIT = 20
const USED_UP = `오늘 운비서를 ${DAILY_LIMIT}번 모두 썼어요. 내일 다시 써 주세요.`
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(status: number, body: Json): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

export function readInput(body: Json): ParseInput | null {
  const row = record(body)
  if (!row) return null
  const text = typeof row.text === 'string' ? row.text.trim() : ''
  if (!text || text.length > TEXT_MAX || !isDateKey(row.today)) return null
  const names = row.clientNames
  if (!Array.isArray(names) || names.length > CLIENTS_MAX) return null
  const clientNames: Array<string> = []
  for (const name of names) {
    if (typeof name !== 'string' || name.length > CLIENT_NAME_MAX) return null
    clientNames.push(name)
  }
  const routeNames = readRouteNames(row.routeNames)
  if (!routeNames) return null
  return { text, today: row.today, clientNames, routeNames }
}

function bearer(req: Request): string {
  return (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
}

async function signedInUserId(req: Request): Promise<string | null> {
  const token = bearer(req)
  const url = Deno.env.get('SUPABASE_URL')
  const key = publishableKey()
  if (!token || !url || !key) return null
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token)
  return error || !data.user ? null : data.user.id
}

async function countToday(req: Request): Promise<boolean | null> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = publishableKey()
  if (!url || !key) return null
  const client = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${bearer(req)}` } } })
  try {
    const { data, error } = await client.rpc('use_unbiseo', { p_kind: 'parse', p_limit: DAILY_LIMIT })
    return error || typeof data !== 'boolean' ? null : data
  } catch {
    return null
  }
}

function publishableKey(): string | null {
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (anon) return anon
  try {
    const keys: Json = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || 'null')
    const named = record(keys)?.default
    return typeof named === 'string' && named ? named : null
  } catch {
    return null
  }
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reply(405, { error: '지원하지 않는 요청입니다.' })
  if (!(await signedInUserId(req))) return reply(401, { error: '로그인이 필요합니다.' })
  let body: Json
  try {
    body = await req.json()
  } catch {
    return reply(400, { error: '요청 모양이 맞지 않습니다.' })
  }
  const input = readInput(body)
  if (!input) return reply(400, { error: '요청 모양이 맞지 않습니다.' })
  const allowed = await countToday(req)
  if (allowed === null) {
    console.error('[unbiseo-parse] count_failed')
    return reply(503, { error: TRY_LATER })
  }
  if (!allowed) return reply(429, { error: USED_UP, limit: DAILY_LIMIT })
  try {
    const raw = await askAi(input)
    const answer = raw === null ? null : readAiAnswer(raw, input)
    if (!answer) {
      console.error('[unbiseo-parse] not_understood')
      return reply(502, { error: NOT_UNDERSTOOD })
    }
    return reply(200, answer)
  } catch (error) {
    console.error('[unbiseo-parse]', error instanceof AiUnavailableError ? `ai_unavailable ${error.message}` : 'failed')
    return reply(503, { error: TRY_LATER })
  }
}
