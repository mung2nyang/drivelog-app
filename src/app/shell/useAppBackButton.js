// @ts-check
// 앱(안드로이드) 뒤로가기 — 크롬처럼 앞 기록으로. 더 돌아갈 기록이 없으면 1번은 종료 안내만, 안내 4초 안에 1번 더면 앱을 닫는다. 웹은 아무것도 안 함.
// 앱에서는 홈 붙잡기 기록(useBackToExit.js)을 쓰지 않는다 — 웹뷰가 화면을 누르기 전에 쌓인 기록은 뒤로가기 때 건너뛰기 때문.
import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { EXIT_HINT, EXIT_WINDOW_MS } from './useBackToExit.js'

/**
 * @param {(message: string) => void} showToast 화면마다 새로 만들어져도 듣기는 다시 붙이지 않는다(가장 최근 것을 씀)
 * @param {number} [windowMs] 테스트용으로만 바꿈
 */
export default function useAppBackButton(showToast, windowMs = EXIT_WINDOW_MS) {
  const toastRef = useRef(showToast)
  useEffect(() => {
    toastRef.current = showToast
  }, [showToast])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined
    let removed = false
    let hintedAt = -Infinity
    /** @type {{ remove: () => Promise<void> } | null} */
    let handle = null
    void import('@capacitor/app').then(async ({ App }) => {
      const added = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
          return
        }
        const now = Date.now()
        if (now - hintedAt < windowMs) {
          void App.exitApp()
          return
        }
        hintedAt = now
        toastRef.current(EXIT_HINT)
      })
      if (removed) void added.remove()
      else handle = added
    })
    return () => {
      removed = true
      void handle?.remove()
    }
  }, [windowMs])
}
