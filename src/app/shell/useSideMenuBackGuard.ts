import { useEffect, useRef } from 'react'

const MENU_GUARD = 'menuGuard'

function menuGuardOnTop() {
  const state = window.history.state
  return Boolean(state && typeof state === 'object' && Reflect.get(state, MENU_GUARD))
}

export default function useSideMenuBackGuard(open: boolean, onClose: () => void) {
  const pushedRef = useRef(false)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  useEffect(() => {
    if (open && !pushedRef.current) {
      pushedRef.current = true
      const state = window.history.state
      window.history.pushState({ ...(state && typeof state === 'object' ? state : {}), [MENU_GUARD]: true }, '')
      return
    }
    if (open || !pushedRef.current) return
    pushedRef.current = false
    if (menuGuardOnTop()) window.history.back()
  }, [open])

  useEffect(() => {
    function onPop() {
      if (pushedRef.current) {
        if (menuGuardOnTop()) return
        pushedRef.current = false
        closeRef.current()
        return
      }
      if (menuGuardOnTop()) window.history.back()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
}
