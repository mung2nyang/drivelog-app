// 구글 알림 서비스(FCM v1) — 서비스 계정 열쇠로 접근 표를 받아(1시간, 끝나기 1분 전까지 재사용) 기기 한 대에 보낸다.
export type Json = string | number | boolean | null | Array<Json> | { [key: string]: Json }
export type ServiceAccount = { projectId: string, clientEmail: string, privateKey: string }
export type Message = { title: string, body: string, path: string }
/** sent: 보냄, gone: 구글이 없는 주소라 함(지워도 됨), failed: 그 밖 실패 */
export type SendResult = 'sent' | 'gone' | 'failed'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
let cached: { key: string, token: string, until: number } | null = null

/** 비밀값 FIREBASE_SERVICE_ACCOUNT(내려받은 JSON 그대로)에서 필요한 칸만. 모양이 틀리면 null. */
export function readServiceAccount(raw: string | undefined): ServiceAccount | null {
  try {
    const value: Json = JSON.parse(raw || 'null')
    const row = value && typeof value === 'object' && !Array.isArray(value) ? value : null
    const projectId = row?.project_id
    const clientEmail = row?.client_email
    const privateKey = row?.private_key
    if (typeof projectId !== 'string' || typeof clientEmail !== 'string' || typeof privateKey !== 'string') return null
    if (!projectId || !clientEmail || !privateKey.includes('PRIVATE KEY')) return null
    return { projectId, clientEmail, privateKey }
  } catch {
    return null
  }
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function text64(value: string): string {
  return base64url(new TextEncoder().encode(value))
}

async function signedAssertion(account: ServiceAccount, now: number): Promise<string> {
  const pem = account.privateKey.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '')
  const der = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const iat = Math.floor(now / 1000)
  const unsigned = `${text64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${text64(JSON.stringify({
    iss: account.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600,
  }))}`
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  return `${unsigned}.${base64url(new Uint8Array(signature))}`
}

/** 구글 접근 표. 실패하면 던진다. */
export async function accessToken(account: ServiceAccount, now = Date.now()): Promise<string> {
  if (cached && cached.key === account.clientEmail && cached.until > now) return cached.token
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: await signedAssertion(account, now) }),
  })
  const body: Json = await response.json().catch(() => null)
  const row = body && typeof body === 'object' && !Array.isArray(body) ? body : null
  const token = row?.access_token
  const expiresIn = typeof row?.expires_in === 'number' ? row.expires_in : 3600
  if (!response.ok || typeof token !== 'string' || !token) throw new Error(`token ${response.status}`)
  cached = { key: account.clientEmail, token, until: now + (expiresIn - 60) * 1000 }
  return token
}

/** 시험용 — 재사용하던 접근 표를 버린다. */
export function forgetAccessToken() {
  cached = null
}

/** 기기 한 대에 보낸다. 앱이 꺼져 있으면 휴대폰이 알림창에 그리고, 누르면 앱이 data.path 화면을 연다. */
export async function sendToDevice(account: ServiceAccount, token: string, deviceToken: string, message: Message): Promise<SendResult> {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.projectId)}/messages:send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title: message.title, body: message.body },
        data: { path: message.path },
        android: { priority: 'HIGH' },
      },
    }),
  }).catch(() => null)
  if (!response) return 'failed'
  if (response.ok) return 'sent'
  const body = await response.text().catch(() => '')
  return response.status === 404 || body.includes('UNREGISTERED') ? 'gone' : 'failed'
}
