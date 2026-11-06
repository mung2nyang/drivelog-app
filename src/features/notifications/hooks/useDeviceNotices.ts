// 앱(안드로이드)일 때만: 휴대폰 알림창 알림을 미리 걸어 두고, 값이 바뀌면 모두 지우고 다시 건다. 누르면 그 화면으로.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { getState, subscribe } from '../../../data/store/app-store.ts'
import { useOwnerClients, useOwnerDrivers, useOwnerProfile, useOwnerSettings, useOwnerWorkDataByLogId } from '../../../data/store/ownerDataHooks.ts'
import type { AppSession } from '../../../data/sync/syncTypes.ts'
import { planDeviceNotices, readDeviceNoticeInput } from '../api/deviceNoticePlan.ts'

const PAGE_PATH: Record<string, string> = { home: '/app', receivables: '/app/receivables', settings: '/app/me/settings' }
// 입력 중 값이 자주 바뀌어도 예약은 잠깐 멈춘 뒤 한 번만 다시 건다.
const REPLAN_DELAY_MS = 1500

// 앱 플러그인은 앱에서만 그때 불러온다(웹 첫 화면을 무겁게 하지 않게).
// 플러그인 객체를 약속 결과로 넘기면 then을 휴대폰 기능으로 불러 실패하므로, 묶음째 넘기고 쓰는 곳에서 꺼낸다.
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
      // 배터리 절약용 "정확한 시각" 권한 없이 건다(몇 분 늦을 수 있음).
      isExactNotification: false,
      schedule: { at: notice.at, allowWhileIdle: true },
      extra: { path: PAGE_PATH[notice.page] || '/app' },
    })),
  })
}

/**
 * @param booting 앱을 켜며 세션을 되살리는 중이면 아무것도 안 한다.
 * @param session 없으면(로그아웃) 걸어 둔 알림을 모두 지운다.
 * @param replanDelayMs 테스트용으로만 바꿈
 */
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

  // 처음 한 번만 휴대폰이 알림 허용을 묻는다(거절하면 다시 묻지 않음).
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

  // 휴대폰 알림을 누르면 그 화면으로. 다른 앱에 갔다 돌아오면 다시 건다.
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
