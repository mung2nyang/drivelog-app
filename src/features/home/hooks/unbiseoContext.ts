import { createContext, createElement, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { UnbiseoRecord } from '../api/unbiseoParse.ts'
import useUnbiseoAssistant from './useUnbiseoAssistant.ts'
import type { UnbiseoAnswer, UnbiseoAssistant } from './useUnbiseoAssistant.ts'

export type OpenAssistantCall = (record: UnbiseoRecord, options: { cancelOff: boolean }) => void

type UnbiseoShared = {
  assistant: UnbiseoAssistant
  openCall: OpenAssistantCall
  dockOpen: boolean
  setDockOpen: (open: boolean) => void
}

const UnbiseoContext = createContext<UnbiseoShared | null>(null)

export function directRecord({ answer, periodNotice, dayOff, callDetailOn }: UnbiseoAssistant): UnbiseoRecord | null {
  if (answer?.client) return answer.client
  if (periodNotice || dayOff) return null
  if (answer?.call) return callDetailOn ? answer.call : null
  return answer?.expense ?? null
}

export function UnbiseoProvider({ onOpenCall, children }: { onOpenCall: OpenAssistantCall, children?: ReactNode }) {
  const assistant = useUnbiseoAssistant()
  const [dockOpen, setDockOpen] = useState(false)
  const openCall: OpenAssistantCall = (call, options) => {
    setDockOpen(false)
    onOpenCall(call, options)
  }
  const seen = useRef<UnbiseoAnswer | null>(null)
  useEffect(() => {
    if (!assistant.answer || seen.current === assistant.answer) return
    seen.current = assistant.answer
    const record = directRecord(assistant)
    // oxlint-disable-next-line react/set-state-in-effect
    if (record) openCall(record, { cancelOff: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistant.answer])
  return createElement(UnbiseoContext.Provider, { value: { assistant, openCall, dockOpen, setDockOpen } }, children)
}

export function useUnbiseo(): UnbiseoShared {
  const shared = useContext(UnbiseoContext)
  if (!shared) throw new Error('UnbiseoProvider 밖에서 운비서를 불렀습니다.')
  return shared
}
