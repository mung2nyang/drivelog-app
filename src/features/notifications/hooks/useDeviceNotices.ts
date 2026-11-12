import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { getState, subscribe } from '../../../data/store/app-store.ts'
import { useOwnerClients, useOwnerDrivers, useOwnerProfile, useOwnerSettings, useOwnerWorkDataByLogId } from '../../../data/store/ownerDataHooks.ts'
import type { AppSession } from '../../../data/sync/syncTypes.ts'
import { planDeviceNotices, readDeviceNoticeInput } from '../api/deviceNoticePlan.ts'

const PAGE_PATH: Record<string, string> = { home: '/app', receivables: '/app/receivables', settings: '/app/me/settings' }
const REPLAN_DELAY_MS = 1500

const loadNotices = () => import('@capacitor/local-notifications')

async function cancelAll() {
  const { LocalNotifications } = await loadNotices()
  const { notifications } = await LocalNotifications.getPending()
  if (notifications.length > 0) await LocalNotifications.cancel({ notifications: notifications.map(({ id }) => ({ id })) })
}

async function replan(ownerKey: string, session: AppSession) {
  await cancelAll()
  const { LocalNotifications } = await loadNotices()
  const plan = planDeviceNotices(readDeviceNoticeInput(ownerKey, session))
  if (plan.length === 0) return
  await LocalNotifications.schedule({
    notifications: plan.map((notice, index) => ({
      id: index + 1,
      title: notice.title,
      body: notice.body,
      largeIcon: 'ic_notice_large',
      isExactNotification: false,
      schedule: { at: notice.at, allowWhileIdle: true },
      extra: { path: PAGE_PATH[notice.page] || '/app' },
    })),
  })
}

export default function useDeviceNotices(ownerKey: string, session: AppSession | null, booting: boolean, replanDelayMs = REPLAN_DELAY_MS) {
  const native = Capacitor.isNativePlatform()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  useEffect(() => { navigateRef.current = navigate }, [navigate])
  const [allowed, setAllowed] = useState(false)
  const [resumeCount, setResumeCount] = useState(0)
  const queueRef = useRef(Promise.resolve())
  const workDataByLogId = useOwnerWorkDataByLogId(ownerKey)
  const settings = useOwnerSettings(ownerKey)
  const drivers = useOwnerDrivers(ownerKey)
  const clients = useOwnerClients(ownerKey)
  const profile = useOwnerProfile(ownerKey)
  const dismissed = useSyncExternalStore(subscribe, () => getState().dismissedNotifications[ownerKey])

  useEffect(() => {
    if (!native) return
    let cancelled = false
    void loadNotices()
      .then(async ({ LocalNotifications }) => {
        const status = await LocalNotifications.checkPermissions()
        return status.display === 'prompt' ? LocalNotifications.requestPermissions() : status
      })
      .then((status) => { if (!cancelled) setAllowed(status.display === 'granted') })
      .catch(() => {})
    return () => { cancelled = true }
  }, [native])

  useEffect(() => {
    if (!native) return
    const tap = loadNotices().then(({ LocalNotifications }) => LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const path = action.notification.extra?.path
      if (typeof path === 'string' && path.startsWith('/app')) navigateRef.current(path)
    }))
    const resume = import('@capacitor/app').then(({ App }) => App.addListener('resume', () => setResumeCount((count) => count + 1)))
    return () => {
      void tap.then((handle) => handle.remove()).catch(() => {})
      void resume.then((handle) => handle.remove()).catch(() => {})
    }
  }, [native])

  useEffect(() => {
    if (!native || booting) return
    const run = (task: () => Promise<void>) => {
      queueRef.current = queueRef.current.then(task).catch((error) => { console.warn('[휴대폰 알림] 예약하지 못했습니다.', error) })
    }
    if (!session) {
      run(cancelAll)
      return
    }
    if (!allowed) return
    const timer = setTimeout(() => run(() => replan(ownerKey, session)), replanDelayMs)
    return () => clearTimeout(timer)
  }, [native, booting, allowed, ownerKey, session, replanDelayMs, resumeCount, workDataByLogId, settings, drivers, clients, profile, dismissed])
}
