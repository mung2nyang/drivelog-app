import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { confirmReloadIfUnsaved } from '../../data/sync/durableWriteGuard.ts'

export const PULL_MAX = 90
export const PULL_TRIGGER = 70

export function insideBlockedArea(target: Element | null, getStyle: (el: Element) => { position: string, overflowY: string } = (el) => window.getComputedStyle(el)) {
  for (let el = target; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const style = getStyle(el)
    if (style.position === 'fixed' || style.position === 'sticky') return true
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return true
  }
  return false
}

export function canStartPull({ standalone, scrollTop, touches, blocked }: { standalone: boolean, scrollTop: number, touches: number, blocked: boolean }) {
  return standalone && scrollTop <= 0 && touches === 1 && !blocked
}

export function pullDistance(fingerDy: number) {
  return fingerDy <= 0 ? 0 : Math.min(PULL_MAX, fingerDy / 2)
}

export function releasePull(distance: number, confirm: () => boolean, reload: () => void) {
  if (distance < PULL_TRIGGER || !confirm()) return false
  reload()
  return true
}

function isStandalone() {
  if (Capacitor.isNativePlatform()) return true
  try {
    return window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

export default function usePullToRefresh(): { distance: number, dragging: boolean, refreshing: boolean } {
  const [pull, setPull] = useState({ distance: 0, dragging: false, refreshing: false })
  const startYRef = useRef<number | null>(null)
  const distanceRef = useRef(0)

  useEffect(() => {
    if (!isStandalone()) return undefined
    const reset = () => {
      startYRef.current = null
      distanceRef.current = 0
      setPull({ distance: 0, dragging: false, refreshing: false })
    }
    const onStart = (event: TouchEvent) => {
      const ok = canStartPull({
        standalone: true,
        scrollTop: window.scrollY,
        touches: event.touches.length,
        blocked: insideBlockedArea(event.target instanceof Element ? event.target : null),
      })
      startYRef.current = ok ? event.touches[0].clientY : null
      distanceRef.current = 0
    }
    const onMove = (event: TouchEvent) => {
      if (startYRef.current === null) return
      if (event.touches.length !== 1) { reset(); return }
      distanceRef.current = pullDistance(event.touches[0].clientY - startYRef.current)
      setPull({ distance: distanceRef.current, dragging: true, refreshing: false })
    }
    const onEnd = () => {
      if (startYRef.current === null) return
      const distance = distanceRef.current
      startYRef.current = null
      distanceRef.current = 0
      if (releasePull(distance, confirmReloadIfUnsaved, () => { window.location.reload() })) {
        setPull({ distance: PULL_TRIGGER, dragging: false, refreshing: true })
      } else {
        setPull({ distance: 0, dragging: false, refreshing: false })
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', reset)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', reset)
    }
  }, [])

  return pull
}
