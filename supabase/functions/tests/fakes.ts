// 서버 함수 시험용 가짜 바깥: 환경 값, 주소별 fetch 답, console 모으기. 시험마다 되돌린다.
export type Answer = (request: Request) => Response | Promise<Response>
export type Handler = (request: Request) => Promise<Response>
export type Outcome = { response: Response, urls: Array<string>, requests: Array<Request>, logs: string }

export const TOKEN = 'fake-user-token'
export const USER_URL = 'https://fake.supabase.test/auth/v1/user'
export const ENV: { [name: string]: string | null } = {
  SUPABASE_URL: 'https://fake.supabase.test',
  SUPABASE_ANON_KEY: 'fake-anon-key',
  SUPABASE_PUBLISHABLE_KEYS: null,
  XAI_API_KEY: 'fake-xai-key',
  KMA_API_KEY: 'fake-kma-key',
}

/** 로그인한 사람이면 사용자, 아니면 거절하는 가짜 Supabase. */
export function signedIn(request: Request): Response {
  return request.headers.get('Authorization') === `Bearer ${TOKEN}`
    ? Response.json({ id: 'user-1', aud: 'authenticated', role: 'authenticated' })
    : Response.json({ code: 401, msg: 'invalid JWT' }, { status: 401 })
}

export function post(body: object | string, token: string | null = TOKEN): Request {
  const headers: { [name: string]: string } = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return new Request('https://fn.test/', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
}

function setEnv(values: { [name: string]: string | null }) {
  for (const [name, value] of Object.entries(values)) {
    if (value === null) Deno.env.delete(name)
    else Deno.env.set(name, value)
  }
}

/** 가짜를 깔고 함수를 한 번 부른 뒤 되돌린다. 답이 없는 주소는 네트워크 실패로 던지고 urls에 남는다. */
export async function callWith(handler: Handler, request: Request, answers: { [url: string]: Answer } = {}, env: { [name: string]: string | null } = {}): Promise<Outcome> {
  const values = { ...ENV, ...env }
  const before = Object.fromEntries(Object.keys(values).map((name) => [name, Deno.env.get(name) ?? null]))
  const realFetch = globalThis.fetch
  const realLog = console.log
  const realError = console.error
  const urls: Array<string> = []
  const requests: Array<Request> = []
  const lines: Array<string> = []
  const keep = (...args: Array<unknown>) => { lines.push(args.map(String).join(' ')) }
  setEnv(values)
  globalThis.fetch = (...args: Parameters<typeof fetch>) => {
    const sent = new Request(...args)
    const url = new URL(sent.url)
    urls.push(url.origin + url.pathname)
    requests.push(sent)
    const answer = { [USER_URL]: signedIn, ...answers }[url.origin + url.pathname]
    return answer ? Promise.resolve().then(() => answer(sent)) : Promise.reject(new TypeError(`가짜에 없는 주소: ${url.origin}${url.pathname}`))
  }
  console.log = keep
  console.error = keep
  try {
    return { response: await handler(request), urls, requests, logs: lines.join('\n') }
  } finally {
    globalThis.fetch = realFetch
    console.log = realLog
    console.error = realError
    setEnv(before)
  }
}
