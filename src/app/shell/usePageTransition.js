// @ts-check
import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/** @typedef {'forward' | 'back' | 'fade' | 'none'} PageTransition */
/** @typedef {{ pathname: string, tab: boolean }} PageSpot */

const TAB_PATHS = new Set(['/app', '/app/calendar', '/app/revenue', '/app/me'])
const ENTER_CLASSES = ['page-enter-forward', 'page-enter-back', 'page-enter-fade']

/** @param {string} pathname */
export function isTabSpot(pathname) {
  return TAB_PATHS.has(pathname)
}

/**
 * @param {{ prev: PageSpot | null, next: PageSpot, navigationType: string }} move
 * @returns {PageTransition}
 */
export function decidePageTransition({ prev, next, navigationType }) {
  if (!prev || prev.pathname === next.pathname) return 'none'
  if (prev.tab && next.tab) return 'fade'
  if (navigationType === 'POP') return 'back'
  if (navigationType === 'PUSH') return 'forward'
  return 'fade'
}

/** @returns {import('react').RefObject<HTMLDivElement | null>} */
export default function usePageTransition() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const boxRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const prevRef = useRef(/** @type {PageSpot | null} */ (null))

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
    /** @param {AnimationEvent} event */
    const done = (event) => { if (event.target === box) box.classList.remove(...ENTER_CLASSES) }
    box.addEventListener('animationend', done)
    box.addEventListener('animationcancel', done)
    return () => {
      box.removeEventListener('animationend', done)
      box.removeEventListener('animationcancel', done)
    }
  }, [])

  return boxRef
}
