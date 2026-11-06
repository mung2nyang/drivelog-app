// 휴대폰 알림 받을 주소를 서버에 맡긴다(0033 함수, 같은 주소면 이 계정 것으로 옮김). 실패하면 던진다.
import { supabase } from './supabaseClient.ts'

export async function registerPushDevice(token: string): Promise<void> {
  const { error } = await supabase.rpc('register_push_device', { p_token: token })
  if (error) throw new Error(error.message || '알림 받을 주소를 맡기지 못했습니다.')
}
