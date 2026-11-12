// @ts-check
import { confirmDialog } from '../../../shared/ui/confirmDialog.tsx'
/**
 * @param {(action: import('../hooks/day-log-reducer.js').DayLogAction) => void} dispatch
 * @param {{ closeAll: () => void, openAdd: (kind: string) => void, openEdit: (item: import('./dayLogTypes.js').ExpenseItem) => void, openKindPick: () => void, modalOpen: boolean, editingId: string|null, draft: { kind?: string } }} expenseForm
 * @param {{ callFormOpen: boolean, editingCallId: string|null }} callPanel
 */
export function bindInlinePanelActions(dispatch, expenseForm, callPanel) {
  return {
    /** @param {string|null} id */
    openCallForm(id) {
      if (id === null && callPanel.callFormOpen && callPanel.editingCallId === null) {
        dispatch({ type: 'closeCallForm' })
        return
      }
      expenseForm.closeAll()
      dispatch({ type: 'openCallForm', id })
    },
    /** @param {string} kind */
    openExpenseAdd(kind) {
      if (expenseForm.modalOpen && expenseForm.editingId === null && expenseForm.draft.kind === kind) {
        expenseForm.closeAll()
        return
      }
      dispatch({ type: 'closeCallForm' })
      expenseForm.openAdd(kind)
    },
    /** @param {import('./dayLogTypes.js').ExpenseItem} item */
    openExpenseEdit(item) {
      dispatch({ type: 'closeCallForm' })
      expenseForm.openEdit(item)
    },
    openExpenseKindPick() {
      dispatch({ type: 'closeCallForm' })
      expenseForm.openKindPick()
    },
    /** @returns {Promise<boolean>} */
    async confirmLeaveOpenPanel() {
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
