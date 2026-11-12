// @ts-check
/** @typedef {import('../../domain/jsonTypes.ts').JsonValue} JsonValue */
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { historyIdx, noteLocation, takeRewind } from '../../shared/utils/historyMoves.ts'
import { useToast } from '../../shared/hooks/useToast.ts'

export const EXIT_HINT = '뒤로가기를 한 번 더 누르면 종료됩니다.'
export const EXIT_WINDOW_MS = 4000

/** @param {{ standalone: boolean, pathname: string, idx: JsonValue|undefined }} where */
export function isExitEdge({ standalone, pathname, idx }) {
  return standalone && pathname === '/app' && idx === 0
}

function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

/** @param {number} [windowMs] */
export default function useBackToExit(windowMs = EXIT_WINDOW_MS) {
  const showToast = useToast()
  const location = useLocation()
  const navigationType = useNavigationType()
  const navigate = useNavigate()
  const armedRef = useRef(false)

  useEffect(() => {
    const idx = historyIdx()
    noteLocation(location.pathname, idx)
    const rewound = takeRewind()
    if (!isExitEdge({ standalone: isStandalone(), pathname: location.pathname, idx })) return undefined
    const guard = () => {
      armedRef.current = true
      navigate({ pathname: location.pathname, search: location.search }, { state: { exitGuard: true } })
    }
    if (navigationType === 'POP' && armedRef.current && !rewound) {
      armedRef.current = false
      showToast?.(EXIT_HINT)
      const timer = setTimeout(guard, windowMs)
      return () => clearTimeout(timer)
    }
    guard()
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])
}
