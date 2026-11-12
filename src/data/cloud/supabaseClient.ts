import { createClient } from '@supabase/supabase-js'
import { routerBasename } from '../../shared/utils/routerBasename.ts'
import { isNativeApp, signInWithGoogleNative } from './nativeGoogleSignIn.ts'

const SUPABASE_URL = 'https://wphlnkfymvpnklgbuxrk.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_JJZxpsvje-LUGmphA70z9Q_Y7WfrM0G'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export function getSupabaseAuthErrorMessage(error: { message?: string } | null | undefined) {
  const msg = error?.message || ''
  if (/network|fetch/i.test(msg)) {
    return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
  }
  return msg || '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

export async function signInWithGoogle() {
  if (isNativeApp()) return signInWithGoogleNative(supabase.auth)
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${routerBasename()}/auth`,
      queryParams: { prompt: 'select_account' },
    },
  })
}

export async function ensureProfileRow(userId: string, accountType: string, name: string, phone: string) {
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    account_type: accountType || null,
    name: name || null,
    phone: phone || null,
  })
  if (error) console.error('profiles 생성 실패:', error)
  return { error }
}
