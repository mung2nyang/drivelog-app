// @ts-check
import { useEffect, useRef, useState } from 'react'

/** @typedef {{ type: 'maint'|'fuel'|'misc', cost: number|null, name: string, category: string, fuelType: string, payment: string, cancelOff: boolean }} AssistantExpense */
/** @typedef {import('../../../domain/expenseTypes.ts').ExpenseDraft} ExpenseDraft */

/** 빈 칸은 넣지 않는다 — 지출 창의 기본값(분류 첫 항목·"주유"·"카드")이 그대로 남는다. @param {AssistantExpense} expense @returns {ExpenseDraft} */
function presetOf(expense) {
  return {
    ...(expense.cost !== null ? { cost: expense.cost } : {}),
    ...(expense.name ? { name: expense.name } : {}),
    ...(expense.category ? { category: expense.category } : {}),
    ...(expense.fuelType ? { fuelType: expense.fuelType } : {}),
    ...(expense.payment ? { payment: expense.payment } : {}),
  }
}

/**
 * @param {Object} args
 * @param {AssistantExpense|null} args.assistantExpense
 * @param {string} [args.assistantCallKey]
 * @param {{ isOff: boolean, fixedCount: number }} args.draft
 * @param {(action: import('./day-log-reducer.js').DayLogAction) => void} args.dispatch
 * @param {(kind: string, preset?: ExpenseDraft) => void} args.openAdd
 * @param {() => Promise<boolean>} args.confirmLeaveOpenPanel
 */
export default function useAssistantExpense({ assistantExpense, assistantCallKey, draft, dispatch, openAdd, confirmLeaveOpenPanel }) {
  const [handoff, setHandoff] = useState(/** @type {{ key: string|undefined, expense: AssistantExpense|null }} */ ({ key: assistantCallKey, expense: assistantExpense }))
  if (assistantExpense && assistantCallKey !== handoff.key) setHandoff({ key: assistantCallKey, expense: assistantExpense })
  const askedRef = useRef(/** @type {object|null} */ (null))
  useEffect(() => {
    if (!handoff.expense || assistantExpense || askedRef.current === handoff) return
    askedRef.current = handoff
    const next = handoff.expense
    void confirmLeaveOpenPanel().then((ok) => {
      setHandoff((prev) => ({ ...prev, expense: null }))
      if (!ok) return
      if (next.cancelOff && draft.isOff) dispatch({ type: 'patchDraft', patch: { isOff: false, fixedCount: draft.fixedCount } })
      dispatch({ type: 'closeCallForm' })
      openAdd(next.type, presetOf(next))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff, assistantExpense])
}
