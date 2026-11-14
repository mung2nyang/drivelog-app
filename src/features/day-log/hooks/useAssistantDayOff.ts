import { useEffect, useRef, useState } from 'react'
import { useToast } from '../../../shared/hooks/useToast.ts'
import { confirmOffWithCalls } from '../ui/OffToggle.tsx'
import { dayOffPatch } from './day-log-reducer.ts'

export type AssistantDayOff = { off: boolean }

type UseAssistantDayOffProps = {
  assistantDayOff: AssistantDayOff|null
  assistantCallKey?: string
  draft: { isOff: boolean, fixedCount: number, callDetails: Array<object> }
  patchDraft: (patch: { isOff?: boolean, fixedCount?: number, palletCount?: number, fixedRouteCounts?: Record<string, number> }) => void
  month: number
  day: number
}

export default function useAssistantDayOff({ assistantDayOff, assistantCallKey, draft, patchDraft, month, day }: UseAssistantDayOffProps) {
  const showToast = useToast()
  const [handoff, setHandoff] = useState<{ key: string|undefined, dayOff: AssistantDayOff|null }>({ key: assistantCallKey, dayOff: assistantDayOff })
  if (assistantDayOff && assistantCallKey !== handoff.key) setHandoff({ key: assistantCallKey, dayOff: assistantDayOff })
  const doneRef = useRef<object|null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  useEffect(() => {
    if (!handoff.dayOff || assistantDayOff || doneRef.current === handoff) return
    doneRef.current = handoff
    const { off } = handoff.dayOff
    if (draft.isOff === off) return
    void (async () => {
      if (!(await confirmOffWithCalls(off, draft.callDetails.length)) || !alive.current) return
      patchDraft(dayOffPatch(off))
      showToast?.(off ? `${month}월 ${day}일을 휴무로 바꿨습니다.` : `${month}월 ${day}일 휴무를 취소했습니다.`)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff, assistantDayOff])
}
