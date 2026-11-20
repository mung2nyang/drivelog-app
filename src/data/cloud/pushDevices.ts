import { supabase } from './supabaseClient.ts'

const UNREGISTER_TIMEOUT_MS = 3000

let registeredToken = ''

export async function registerPushDevice(token: string): Promise<void> {
  const { error } = await supabase.rpc('register_push_device', { p_token: token })
  if (error) throw new Error(error.message || '알림 받을 주소를 맡기지 못했습니다.')
  registeredToken = token
}

export async function unregisterPushDevice(): Promise<void> {
  const token = registeredToken
  if (!token) return
  registeredToken = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => { timer = setTimeout(resolve, UNREGISTER_TIMEOUT_MS) })
  const request = Promise.resolve()
    .then(() => supabase.rpc('unregister_push_device', { p_token: token }))
    .then(() => undefined, () => undefined)
  await Promise.race([request, timeout])
  clearTimeout(timer)
}
