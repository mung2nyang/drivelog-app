// @ts-check
// 앱(안드로이드) 뒤로가기 — 크롬처럼 앞 기록으로, 더 돌아갈 기록이 없으면 앱을 닫는다. 웹은 아무것도 안 함.
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

export default function useAppBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined
    let removed = false
    /** @type {{ remove: () => Promise<void> } | null} */
    let handle = null
    void import('@capacitor/app').then(async ({ App }) => {
      const added = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back()
        else void App.exitApp()
      })
      if (removed) void added.remove()
      else handle = added
    })
    return () => {
      removed = true
      void handle?.remove()
    }
  }, [])
}
