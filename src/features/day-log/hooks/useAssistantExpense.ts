import { useEffect, useRef, useState } from 'react'
import type { ExpenseDraft } from '../../../domain/expenseTypes.ts'
import type { DayLogAction } from './day-log-reducer.ts'

export type AssistantExpense = { type: 'maint'|'fuel'|'misc', cost: number|null, name: string, category: string, fuelType: string, payment: string, cancelOff: boolean }
function presetOf(expense: AssistantExpense): ExpenseDraft {
  return {
    ...(expense.cost !== null ? { cost: expense.cost } : {}),
    ...(expense.name ? { name: expense.name } : {}),
    ...(expense.category ? { category: expense.category } : {}),
    ...(expense.fuelType ? { fuelType: expense.fuelType } : {}),
    ...(expense.payment ? { payment: expense.payment } : {}),
  }
}

type UseAssistantExpenseProps = {
  assistantExpense: AssistantExpense|null
  assistantCallKey?: string
  draft: { isOff: boolean, fixedCount: number }
  dispatch: (action: DayLogAction) => void
  openAdd: (kind: string, preset?: ExpenseDraft) => void
  confirmLeaveOpenPanel: () => Promise<boolean>
}

export default function useAssistantExpense({ assistantExpense, assistantCallKey, draft, dispatch, openAdd, confirmLeaveOpenPanel }: UseAssistantExpenseProps) {
  const [handoff, setHandoff] = useState<{ key: string|undefined, expense: AssistantExpense|null }>({ key: assistantCallKey, expense: assistantExpense })
  if (assistantExpense && assistantCallKey !== handoff.key) setHandoff({ key: assistantCallKey, expense: assistantExpense })
  const askedRef = useRef<object|null>(null)
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
