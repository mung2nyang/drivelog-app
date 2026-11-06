// 앱(안드로이드)·로그인 계정일 때만: 서버가 보내는 알림을 받을 주소를 서버에 맡기고, 로그아웃하면 휴대폰 주소를 지운다. 누르면 그 화면으로.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { isCloudSession } from '../../../data/cloud/cloudSession.ts'
import { registerPushDevice } from '../../../data/cloud/pushDevices.ts'
import type { AppSession } from '../../../data/sync/syncTypes.ts'

// 앱 플러그인은 앱에서만 그때 불러온다. 플러그인 객체를 약속 결과로 넘기면 then을 휴대폰 기능으로 불러 실패하므로 묶음째 넘긴다.
const loadPush = () => import('@capacitor/push-notifications')

function warn(error: Error | string) {
  console.warn('[서버 알림] 받을 주소를 맡기지 못했습니다.', error)
}

/** @param booting 앱을 켜며 세션을 되살리는 중이면 아무것도 안 한다. */
export default function useServerPush(session: AppSession | null, booting: boolean) {
  // 푸시 장치가 없는 옛 앱(스토어 1.0.1·1.0.2)에서는 아무것도 안 한다.
  const available = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('PushNotifications')
  const userId = isCloudSession(session) ? session?.userId ?? null : null
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  const userIdRef = useRef(userId)
  const registeredRef = useRef(false)
  const [resumeCount, setResumeCount] = useState(0)
  useEffect(() => { navigateRef.current = navigate }, [navigate])
  useEffect(() => { userIdRef.current = userId }, [userId])

  // 주소를 받으면 지금 계정으로 맡긴다. 알림을 누르면 그 화면으로. 다른 앱에 갔다 오면(알림 허용 창 포함) 다시 확인.
  useEffect(() => {
    if (!available) return
    const handles = [
      loadPush().then(({ PushNotifications }) => PushNotifications.addListener('registration', ({ value }) => {
        if (userIdRef.current) registerPushDevice(value).catch(warn)
      })),
      loadPush().then(({ PushNotifications }) => PushNotifications.addListener('registrationError', ({ error }) => warn(error))),
      loadPush().then(({ PushNotifications }) => PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const path = notification.data?.path
        if (typeof path === 'string' && path.startsWith('/app')) navigateRef.current(path)
      })),
      import('@capacitor/app').then(({ App }) => App.addListener('resume', () => setResumeCount((count) => count + 1))),
    ]
    return () => { handles.forEach((handle) => { void handle.then((h) => h.remove()).catch(() => {}) }) }
  }, [available])

  useEffect(() => {
    if (!available || booting) return
    if (!userId) {
      if (!registeredRef.current) return
      registeredRef.current = false
      void loadPush().then(({ PushNotifications }) => PushNotifications.unregister()).catch(warn)
      return
    }
    // 알림 허용은 앱을 처음 켤 때 한 번 묻는 것(휴대폰 예약 알림)을 그대로 쓴다 — 여기서는 묻지 않는다.
    void loadPush()
      .then(async ({ PushNotifications }) => {
        const status = await PushNotifications.checkPermissions()
        if (status.receive !== 'granted') return
        registeredRef.current = true
        await PushNotifications.register()
      })
      .catch(warn)
  }, [available, booting, userId, resumeCount])
}
