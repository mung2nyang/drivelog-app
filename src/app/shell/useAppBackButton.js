// @ts-check
import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { EXIT_HINT, EXIT_WINDOW_MS } from './useBackToExit.js'

/**
 * @param {(message: string) => void} showToast
 * @param {number} [windowMs]
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
