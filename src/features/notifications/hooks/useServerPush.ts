import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { isCloudSession } from '../../../data/cloud/cloudSession.ts'
import { registerPushDevice } from '../../../data/cloud/pushDevices.ts'
import type { AppSession } from '../../../data/sync/syncTypes.ts'

const loadPush = () => import('@capacitor/push-notifications')

function warn(error: Error | string) {
  console.warn('[서버 알림] 받을 주소를 맡기지 못했습니다.', error)
}

export default function useServerPush(session: AppSession | null, booting: boolean) {
  const available = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('PushNotifications')
  const userId = isCloudSession(session) ? session?.userId ?? null : null
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  const userIdRef = useRef(userId)
  const registeredRef = useRef(false)
  const [resumeCount, setResumeCount] = useState(0)
  useEffect(() => { navigateRef.current = navigate }, [navigate])
  useEffect(() => { userIdRef.current = userId }, [userId])

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
