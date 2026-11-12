// @ts-check
import { useEffect, useRef, useState } from 'react'

/** @typedef {{ loadLoc: string, unloadLoc: string, fare: number|null, client: string, cancelOff: boolean }} AssistantCall */

/**
 * @param {Object} args
 * @param {AssistantCall|null} args.assistantCall
 * @param {string} [args.assistantCallKey]
 * @param {boolean} args.callDetailOn
 * @param {{ isOff: boolean, fixedCount: number }} args.draft
 * @param {boolean} args.callFormOpen
 * @param {string|null} args.editingCallId
 * @param {(action: import('./day-log-reducer.js').DayLogAction) => void} args.dispatch
 * @param {() => void} args.closeExpense
 * @param {() => Promise<boolean>} args.confirmLeaveOpenPanel
 * @returns {{ prefill: AssistantCall|null, formKey: string }}
 */
export default function useAssistantPrefill({ assistantCall, assistantCallKey, callDetailOn, draft, callFormOpen, editingCallId, dispatch, closeExpense, confirmLeaveOpenPanel }) {
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

  const [handoff, setHandoff] = useState(/** @type {{ key: string|undefined, call: AssistantCall|null }} */ ({ key: assistantCallKey, call: null }))
  if (assistantCall && assistantCallKey !== handoff.key) setHandoff({ key: assistantCallKey, call: assistantCall })
  const askedRef = useRef(/** @type {object|null} */ (null))
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
