import { supabase } from '../data/cloud/supabaseClient.ts'
import { hydrateFromSupabase } from '../data/hydrate/hydrate.ts'
import { singleFlight } from '../data/cloud/singleFlight.ts'
import { LINK_RETRY_MS, buildBootSession, isProfileRowMissing, ownerKeyFromSession } from '../data/cloud/appSession.ts'
import type { AppSession } from '../data/sync/syncTypes.ts'

export function restoreSessionOnBoot(retryMs = LINK_RETRY_MS): Promise<{ session: AppSession, hydrateError: boolean, needsProfile: boolean } | { linkCheckFailed: true } | null> {
  return singleFlight('boot:restoreSession', () => performRestoreSessionOnBoot(retryMs))
}

async function performRestoreSessionOnBoot(retryMs: number) {
  let authUser
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data?.session?.user) return null
    authUser = data.session.user
  } catch (error) {
    console.error('[boot] 세션 복원 실패:', error)
    return null
  }

  const userId = authUser.id
  const session = await buildBootSession(userId, {
    name: authUser.user_metadata?.name || '',
    phone: authUser.phone || '',
  }, retryMs)
  if (!session) return { linkCheckFailed: true as const }
  if (!session.name) session.name = authUser.user_metadata?.name || ''
  if (!session.phone) session.phone = authUser.phone || ''

  const needsProfile = await isProfileRowMissing(userId)
  const ownerKey = ownerKeyFromSession(session)
  try {
    await hydrateFromSupabase(userId, ownerKey, { employedDriver: !!session.linkedOwnerId })
    return { session, hydrateError: false, needsProfile }
  } catch (error) {
    console.error('[boot] hydrate 실패, 서버 기록 없이 계속합니다.', error)
    return { session, hydrateError: true, needsProfile }
  }
}
