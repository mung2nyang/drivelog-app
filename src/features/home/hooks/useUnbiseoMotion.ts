import { useCallback, useEffect, useState } from 'react'
import type { UnbiseoAnswer } from './useUnbiseoAssistant.ts'

export type Situation = 'rest' | 'listen' | 'type' | 'talk'

export type UnbiseoMotion = { situation: Situation, loops: 'infinite' | 2, key: string }

type Watched = { speaking: boolean, answer: UnbiseoAnswer | null, busy: boolean, listening: boolean, text: string }

const TYPING_PAUSE_MS = 1000

export default function useUnbiseoMotion({ speaking, answer, busy, listening, text }: Watched) {
  const [seen, setSeen] = useState({ speaking, answer, text })
  const [reply, setReply] = useState({ count: 0, on: false })
  const [typing, setTyping] = useState(0)
  if (seen.speaking !== speaking || seen.answer !== answer || seen.text !== text) {
    setSeen({ speaking, answer, text })
    if (speaking && !seen.speaking) setReply({ count: reply.count, on: false })
    else if (!speaking && answer && answer !== seen.answer && !busy) setReply({ count: reply.count + 1, on: true })
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
