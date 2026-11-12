import { useEffect, useRef, useState } from 'react'
import { cancelConfirmDialog, confirmDialogOpen } from '../../../shared/ui/confirmDialog.tsx'

const MODAL_GUARD = 'modalGuard'

function currentState(): object | null {
  const state: object | null = typeof window.history.state === 'object' ? window.history.state : null
  return state
}

function modalGuardOnTop(): boolean {
  const state = currentState()
  return Boolean(state && Reflect.get(state, MODAL_GUARD))
}

export default function useModalBackGuard(open: boolean, onBack: () => void) {
  const pushedRef = useRef(false)
  const backRef = useRef(onBack)
  useEffect(() => { backRef.current = onBack })
  const [repush, setRepush] = useState(0)

  useEffect(() => {
    if (open && !pushedRef.current) {
      pushedRef.current = true
      window.history.pushState({ ...(currentState() || {}), [MODAL_GUARD]: true }, '')
      return
    }
    if (open || !pushedRef.current) return
    pushedRef.current = false
    if (modalGuardOnTop()) window.history.back()
  }, [open, repush])

  useEffect(() => {
    function onPop() {
      if (!pushedRef.current || modalGuardOnTop()) return
      pushedRef.current = false
      setRepush((n) => n + 1)
      if (confirmDialogOpen()) { cancelConfirmDialog(); return }
      backRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
}
