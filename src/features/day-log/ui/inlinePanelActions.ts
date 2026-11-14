import { confirmDialog } from '../../../shared/ui/confirmDialog.tsx'
import type { DayLogAction } from '../hooks/day-log-reducer.ts'
import type { ExpenseItem } from './dayLogTypes.ts'

type ExpenseFormControls = { closeAll: () => void, openAdd: (kind: string) => void, openEdit: (item: ExpenseItem) => void, openKindPick: () => void, modalOpen: boolean, editingId: string|null, draft: { kind?: string } }
type CallPanelState = { callFormOpen: boolean, editingCallId: string|null }

export function bindInlinePanelActions(dispatch: (action: DayLogAction) => void, expenseForm: ExpenseFormControls, callPanel: CallPanelState) {
  return {
    openCallForm(id: string | null) {
      if (id === null && callPanel.callFormOpen && callPanel.editingCallId === null) {
        dispatch({ type: 'closeCallForm' })
        return
      }
      expenseForm.closeAll()
      dispatch({ type: 'openCallForm', id })
    },
    openExpenseAdd(kind: string) {
      if (expenseForm.modalOpen && expenseForm.editingId === null && expenseForm.draft.kind === kind) {
        expenseForm.closeAll()
        return
      }
      dispatch({ type: 'closeCallForm' })
      expenseForm.openAdd(kind)
    },
    openExpenseEdit(item: ExpenseItem) {
      dispatch({ type: 'closeCallForm' })
      expenseForm.openEdit(item)
    },
    openExpenseKindPick() {
      dispatch({ type: 'closeCallForm' })
      expenseForm.openKindPick()
    },
    async confirmLeaveOpenPanel(): Promise<boolean> {
      if (!callPanel.callFormOpen && !expenseForm.modalOpen) return true
      return confirmDialog({
        title: '저장하지 않은 입력이 있습니다',
        message: '지금 나가면 입력한 내용이 사라집니다.',
        confirmLabel: '나가기',
        cancelLabel: '계속 입력',
        danger: true,
      })
    },
  }
}
