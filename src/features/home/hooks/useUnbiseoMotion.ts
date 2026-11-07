// 운비서 상황 고르기 — 말하기 > 듣기 > 글 답(두 바퀴) > 입력 > 쉴 때.
import { useCallback, useEffect, useState } from 'react'

/** 상황 이름(`unbiseo-<이름>.webp`). */
export type Situation = 'rest' | 'listen' | 'type' | 'talk'

/** loops: 계속이면 'infinite', key: 같은 상황도 처음 칸부터 다시 틀기 위한 이름. */
export type UnbiseoMotion = { situation: Situation, loops: 'infinite' | 2, key: string }

type Watched = { speaking: boolean, answer: unknown, busy: boolean, listening: boolean, text: string }

const TYPING_PAUSE_MS = 1000

export default function useUnbiseoMotion({ speaking, answer, busy, listening, text }: Watched) {
  const [seen, setSeen] = useState({ speaking, answer, text })
  // 글로만 온 답: 센 번호(처음 칸부터 다시 틀 때 쓰임)와 지금 두 바퀴를 도는 중인지.
  const [reply, setReply] = useState({ count: 0, on: false })
  // 입력 중: 마지막으로 친 때를 세는 번호(0이면 입력 중 아님).
  const [typing, setTyping] = useState(0)
  // 기다리는 중의 임시 답("알아듣는 중…")이나 소리로 읽을 답은 두 바퀴 짜리로 치지 않는다.
  if (seen.speaking !== speaking || seen.answer !== answer || seen.text !== text) {
    setSeen({ speaking, answer, text })
    if (speaking && !seen.speaking) setReply({ count: reply.count, on: false })
    else if (!speaking && answer && answer !== seen.answer && !busy) setReply({ count: reply.count + 1, on: true })
    // 마이크로 들은 말이 칸에 들어가면 바로 보내져 busy가 같이 참 — 입력으로 치지 않는다.
    if (text !== seen.text) setTyping(text.trim() && !busy && !listening ? typing + 1 : 0)
  }

  useEffect(() => {
    if (!typing) return undefined
    const timer = setTimeout(() => setTyping(0), TYPING_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [typing])

  const done = useCallback(() => setReply((current) => ({ count: current.count, on: false })), [])

  let motion: UnbiseoMotion = { situation: 'rest', loops: 'infinite', key: 'rest' }
  if (speaking) motion = { situation: 'talk', loops: 'infinite', key: 'speak' }
  else if (listening) motion = { situation: 'listen', loops: 'infinite', key: 'listen' }
  else if (reply.on) motion = { situation: 'talk', loops: 2, key: `reply-${reply.count}` }
  else if (typing) motion = { situation: 'type', loops: 'infinite', key: 'typing' }
  return { motion, done }
}
