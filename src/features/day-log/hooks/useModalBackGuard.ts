// 창이 열린 동안 붙잡기 기록을 1장 쌓아, 휴대폰 뒤로가기는 창만 닫는다(옆 메뉴와 같은 방식).
import { useEffect, useRef, useState } from 'react'
import { cancelConfirmDialog, confirmDialogOpen } from '../../../shared/ui/confirmDialog.jsx'

const MODAL_GUARD = 'modalGuard'

function currentState(): object | null {
  const state: object | null = typeof window.history.state === 'object' ? window.history.state : null
  return state
}

function modalGuardOnTop(): boolean {
  const state = currentState()
  return Boolean(state && Reflect.get(state, MODAL_GUARD))
}

/**
 * @param open 창이 열려 있나
 * @param onBack 뒤로가기로 붙잡기 기록이 빠졌을 때 할 일(창이 그대로 열려 있으면 기록을 다시 쌓는다)
 */
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
      // 확인 창이 떠 있으면 확인 창만 닫는다.
      if (confirmDialogOpen()) { cancelConfirmDialog(); return }
      backRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
}
