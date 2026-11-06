// @ts-check
// 옆 메뉴가 열린 동안 붙잡기 기록을 1장 쌓아, 휴대폰 뒤로가기는 메뉴만 닫는다.
// 화면 이동 장치(라우터)를 거치지 않고 같은 주소·같은 기록 표시로 1장 더 쌓아서, 빠질 때 다른 화면 규칙(홈 종료 안내 등)이 움직이지 않는다.
import { useEffect, useRef } from 'react'

const MENU_GUARD = 'menuGuard'

function menuGuardOnTop() {
  const state = window.history.state
  return Boolean(state && typeof state === 'object' && Reflect.get(state, MENU_GUARD))
}

/**
 * @param {boolean} open 메뉴가 열려 있나
 * @param {() => void} onClose 메뉴 닫기
 */
export default function useSideMenuBackGuard(open, onClose) {
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
    // 바깥 누르기 등으로 닫혔다 — 붙잡기 기록이 맨 위면 조용히 뺀다(항목으로 이동했으면 그 위에 새 화면이 있어 그대로 둔다).
    pushedRef.current = false
    if (menuGuardOnTop()) window.history.back()
  }, [open])

  useEffect(() => {
    function onPop() {
      if (pushedRef.current) {
        // 뒤로가기로 붙잡기 기록이 빠졌다 — 메뉴만 닫는다.
        if (menuGuardOnTop()) return
        pushedRef.current = false
        closeRef.current()
        return
      }
      // 메뉴 항목으로 간 화면에서 뒤로 왔더니 남은 붙잡기 기록이다 — 한 장 더 돌아가 원래 화면으로.
      if (menuGuardOnTop()) window.history.back()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
}
