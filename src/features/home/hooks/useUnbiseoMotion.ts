// 운비서 동작 고르기 — 소리 내 말하는 동안은 반복, 글로만 답하면 두 번. 동작은 차례로 바꾼다.
import { useCallback, useEffect, useState } from 'react'

/** 동작 그림 이름(`unbiseo-<이름>.webp`). */
export type MotionName = 'blink' | 'smile' | 'move-a' | 'move-b'

/** name: 동작 그림, loops: 계속이면 'infinite', key: 같은 동작도 처음부터 다시 틀기 위한 이름. */
export type UnbiseoMotion = { name: MotionName, loops: 'infinite' | 2, key: string } | null

type Talk = { name: MotionName, loops: 'infinite' | 2, key: number } | null

type Watched = { speaking: boolean, answer: unknown, busy: boolean, listening: boolean, text: string }

// 운비서가 말할 때 번갈아 쓰는 동작. 듣는 중은 깜빡임, 입력 중은 움직임 나.
const TALK_MOTIONS: Array<MotionName> = ['smile', 'move-a']
const TYPING_PAUSE_MS = 1000

// 화면을 옮겨도 차례를 이어서 센다.
let taken = 0

/** 다음 차례 동작 — 여기서는 읽기만 하고, 센 수는 그림을 그린 뒤에 올린다. */
function nextTalk(loops: 'infinite' | 2): Talk {
  return { name: TALK_MOTIONS[taken % TALK_MOTIONS.length], loops, key: taken + 1 }
}

/** 시험에서 차례를 처음으로 되돌린다. */
export function resetMotionOrder() {
  taken = 0
}

export default function useUnbiseoMotion({ speaking, answer, busy, listening, text }: Watched) {
  const [seen, setSeen] = useState({ speaking, answer, text })
  const [talk, setTalk] = useState<Talk>(() => (speaking ? nextTalk('infinite') : null))
  // 입력 중: 마지막으로 친 때를 세는 번호(0이면 입력 중 아님).
  const [typing, setTyping] = useState(0)
  // 기다리는 중의 임시 답("알아듣는 중…")이나 소리로 읽을 답은 두 번 짜리로 움직이지 않는다.
  if (seen.speaking !== speaking || seen.answer !== answer || seen.text !== text) {
    setSeen({ speaking, answer, text })
    if (speaking && !seen.speaking) setTalk(nextTalk('infinite'))
    else if (!speaking && seen.speaking) setTalk(null)
    else if (!speaking && answer && answer !== seen.answer && !busy) setTalk(nextTalk(2))
    // 마이크로 들은 말이 칸에 들어가면 바로 보내져 busy가 같이 참 — 입력으로 치지 않는다.
    if (text !== seen.text) setTyping(text.trim() && !busy && !listening ? typing + 1 : 0)
  }

  useEffect(() => {
    if (talk) taken = Math.max(taken, talk.key)
  }, [talk])

  useEffect(() => {
    if (!typing) return undefined
    const timer = setTimeout(() => setTyping(0), TYPING_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [typing])

  const done = useCallback(() => setTalk(null), [])

  let motion: UnbiseoMotion = null
  if (speaking && talk) motion = { name: talk.name, loops: 'infinite', key: `talk-${talk.key}` }
  else if (listening) motion = { name: 'blink', loops: 'infinite', key: 'listen' }
  else if (talk) motion = { name: talk.name, loops: talk.loops, key: `talk-${talk.key}` }
  else if (typing) motion = { name: 'move-b', loops: 'infinite', key: 'typing' }
  return { motion, done }
}
