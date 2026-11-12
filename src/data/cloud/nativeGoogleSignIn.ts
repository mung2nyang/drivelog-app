// 앱(안드로이드) 안 구글 로그인 — 계정 선택 창에서 받은 토큰으로 Supabase에 로그인한다.
import { Capacitor } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { routerBasename } from '../../shared/utils/routerBasename.ts'

/** Supabase 구글 로그인에 등록된 웹 클라이언트 ID(공개 값). */
export const GOOGLE_WEB_CLIENT_ID = '204535279698-t1ingsmv9iocrb6mf8qvrmsjmcp6i9b6.apps.googleusercontent.com'

export const NATIVE_GOOGLE_FAILED = '구글 로그인을 마치지 못했습니다. 다시 시도해 주세요.'

type IdTokenAuth = Pick<SupabaseClient['auth'], 'signInWithIdToken'>

export function isNativeApp() {
  return Capacitor.isNativePlatform()
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 구글에는 해시한 nonce, Supabase에는 원래 nonce를 넘긴다(Supabase가 해시해 토큰과 맞춰 본다).
 * 성공하면 /auth를 다시 열어 부트 복원(boot.js)이 로그인 뒤 처리를 이어받는다.
 * @param openPage 테스트용으로만 바꿈
 */
export async function signInWithGoogleNative(
  auth: IdTokenAuth,
  openPage: (path: string) => void = (path) => window.location.replace(path),
) {
  try {
    const { SocialLogin } = await import('@capgo/capacitor-social-login')
    await SocialLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID, mode: 'online' } })
    const rawNonce = crypto.randomUUID()
    const { result } = await SocialLogin.login({
      provider: 'google',
      options: { nonce: await sha256Hex(rawNonce) },
    })
    const idToken = result.responseType === 'online' ? result.idToken : null
    if (!idToken) return { error: { message: NATIVE_GOOGLE_FAILED } }
    const { error } = await auth.signInWithIdToken({ provider: 'google', token: idToken, nonce: rawNonce })
    if (error) {
      console.error('[google] 앱 로그인 실패:', error)
      return { error: { message: NATIVE_GOOGLE_FAILED } }
    }
    openPage(`${routerBasename()}/auth`)
    return { error: null }
  } catch (error) {
    console.error('[google] 앱 계정 선택 실패:', error)
    return { error: { message: NATIVE_GOOGLE_FAILED } }
  }
}
