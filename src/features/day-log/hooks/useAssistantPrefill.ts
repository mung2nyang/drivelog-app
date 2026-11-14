import { useEffect, useRef, useState } from 'react'
import type { DayLogAction } from './day-log-reducer.ts'

export type AssistantCall = { loadLoc: string, unloadLoc: string, fare: number|null, client: string, cancelOff: boolean }

type UseAssistantPrefillProps = {
  assistantCall: AssistantCall|null
  assistantCallKey?: string
  callDetailOn: boolean
  draft: { isOff: boolean, fixedCount: number }
  callFormOpen: boolean
  editingCallId: string|null
  dispatch: (action: DayLogAction) => void
  closeExpense: () => void
  confirmLeaveOpenPanel: () => Promise<boolean>
}

export default function useAssistantPrefill({ assistantCall, assistantCallKey, callDetailOn, draft, callFormOpen, editingCallId, dispatch, closeExpense, confirmLeaveOpenPanel }: UseAssistantPrefillProps): { prefill: AssistantCall|null, formKey: string } {
  const [prefill, setPrefill] = useState(() => (assistantCall && callDetailOn ? assistantCall : null))
  const [prefillShown, setPrefillShown] = useState(false)
  const [formKey, setFormKey] = useState('new')
  if (prefill && !prefillShown && callFormOpen && !editingCallId) setPrefillShown(true)
  if (prefill && prefillShown && (!callFormOpen || editingCallId)) setPrefill(null)
  useEffect(() => {
    if (!prefill || prefillShown || assistantCall) return
    if (prefill.cancelOff && draft.isOff) dispatch({ type: 'patchDraft', patch: { isOff: false, fixedCount: draft.fixedCount } })
    dispatch({ type: 'openCallForm', id: null })
  }, [prefill, prefillShown, assistantCall, draft.isOff, draft.fixedCount, dispatch])

  const [handoff, setHandoff] = useState<{ key: string|undefined, call: AssistantCall|null }>({ key: assistantCallKey, call: null })
  if (assistantCall && assistantCallKey !== handoff.key) setHandoff({ key: assistantCallKey, call: assistantCall })
  const askedRef = useRef<object|null>(null)
  useEffect(() => {
    if (!handoff.call || assistantCall || askedRef.current === handoff) return
    askedRef.current = handoff
    const next = handoff.call
    void confirmLeaveOpenPanel().then((ok) => {
      setHandoff((prev) => ({ ...prev, call: null }))
      if (!ok || !callDetailOn) return
      closeExpense()
      dispatch({ type: 'closeCallForm' })
      setPrefill(next)
      setPrefillShown(false)
      setFormKey(`new:${handoff.key}`)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff, assistantCall])

  return { prefill: editingCallId ? null : prefill, formKey }
}
