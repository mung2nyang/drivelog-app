// 운비서 동작 고르기 — 소리 내 말하는 동안은 반복, 글로만 답하면 두 번. 동작은 차례로 바꾼다.
import { useCallback, useEffect, useState } from 'react'

/** 동작 그림 수(`unbiseo-motion-1.webp` … `-6.webp`). */
export const MOTION_COUNT = 6

/** number: 동작 그림 번호(1부터), loops: 계속이면 'infinite', key: 같은 동작도 처음부터 다시 틀기 위한 번호. */
export type UnbiseoMotion = { number: number, loops: 'infinite' | 2, key: number } | null

type Watched = { speaking: boolean, answer: unknown, busy: boolean }

// 화면을 옮겨도 차례를 이어서 센다.
let taken = 0

/** 다음 차례 동작 — 여기서는 읽기만 하고, 센 수는 그림을 그린 뒤에 올린다. */
function nextMotion(loops: 'infinite' | 2): UnbiseoMotion {
  return { number: (taken % MOTION_COUNT) + 1, loops, key: taken + 1 }
}

/** 시험에서 차례를 처음으로 되돌린다. */
export function resetMotionOrder() {
  taken = 0
}

export default function useUnbiseoMotion({ speaking, answer, busy }: Watched) {
  const [seen, setSeen] = useState({ speaking, answer })
  const [motion, setMotion] = useState<UnbiseoMotion>(() => (speaking ? nextMotion('infinite') : null))
  // 기다리는 중의 임시 답("알아듣는 중…")이나 소리로 읽을 답은 두 번 짜리로 움직이지 않는다.
  if (seen.speaking !== speaking || seen.answer !== answer) {
    setSeen({ speaking, answer })
    if (speaking && !seen.speaking) setMotion(nextMotion('infinite'))
    else if (!speaking && seen.speaking) setMotion(null)
    else if (!speaking && answer && answer !== seen.answer && !busy) setMotion(nextMotion(2))
  }

  useEffect(() => {
    if (motion) taken = Math.max(taken, motion.key)
  }, [motion])

  const done = useCallback(() => setMotion(null), [])
  return { motion, done }
}
