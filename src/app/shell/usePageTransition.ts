import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import type { RefObject } from 'react'

export type PageTransition = 'forward' | 'back' | 'fade' | 'none'
export type PageSpot = { pathname: string, tab: boolean }

const TAB_PATHS = new Set(['/app', '/app/calendar', '/app/revenue', '/app/me'])
const ENTER_CLASSES = ['page-enter-forward', 'page-enter-back', 'page-enter-fade']

export function isTabSpot(pathname: string) {
  return TAB_PATHS.has(pathname)
}

export function decidePageTransition({ prev, next, navigationType }: { prev: PageSpot | null, next: PageSpot, navigationType: string }): PageTransition {
  if (!prev || prev.pathname === next.pathname) return 'none'
  if (prev.tab && next.tab) return 'fade'
  if (navigationType === 'POP') return 'back'
  if (navigationType === 'PUSH') return 'forward'
  return 'fade'
}

export default function usePageTransition(): RefObject<HTMLDivElement | null> {
  const location = useLocation()
  const navigationType = useNavigationType()
  const boxRef = useRef<HTMLDivElement | null>(null)
  const prevRef = useRef<PageSpot | null>(null)

  useLayoutEffect(() => {
    const next = { pathname: location.pathname, tab: isTabSpot(location.pathname) }
    const kind = decidePageTransition({ prev: prevRef.current, next, navigationType })
    prevRef.current = next
    const box = boxRef.current
    if (!box || kind === 'none') return
    box.classList.remove(...ENTER_CLASSES)
    void box.offsetWidth
    box.classList.add(`page-enter-${kind}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return undefined
    const done = (event: AnimationEvent) => { if (event.target === box) box.classList.remove(...ENTER_CLASSES) }
    box.addEventListener('animationend', done)
    box.addEventListener('animationcancel', done)
    return () => {
      box.removeEventListener('animationend', done)
      box.removeEventListener('animationcancel', done)
    }
  }, [])

  return boxRef
}
