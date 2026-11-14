import { KINDS } from '../../../domain/expenses.ts'
import ExpenseFormModal from '../../expenses/ui/ExpenseFormModal.tsx'
import ExpenseGroups from './ExpenseGroups.tsx'
import ExpenseSelectPanel from './ExpenseSelectPanel.tsx'
import InlineSheet from './InlineSheet.tsx'
import './day-log-expenses.css'
import type { useExpenseForm } from '../hooks/useExpenseForm.ts'
import type { ExpenseItem } from './dayLogTypes.ts'

const KIND_ADD_CLASS: Record<string, string> = { maint: 'maint-add-direct-btn', fuel: 'fuel-add-direct-btn', misc: 'misc-add-direct-btn' }

export type ExpenseFormApi = ReturnType<typeof useExpenseForm>

type DayLogExpensesProps = {
  dayExpenses: Array<ExpenseItem>
  expenseForm: ExpenseFormApi
  callFormOpen: boolean
  onKindPick: () => void
  onAdd: (kind: string) => void
  onEdit: (item: ExpenseItem) => void
}

export default function DayLogExpenses({ dayExpenses, expenseForm, callFormOpen, onKindPick, onAdd, onEdit }: DayLogExpensesProps) {
  return (
    <div className="modal-section maint-section">
      <div className="modal-section-title">
        <span>차량 유지비</span>
        <button type="button" className="compact-add-btn" onClick={onKindPick}>+ 추가</button>
      </div>
      <ExpenseGroups dayExpenses={dayExpenses} onEdit={onEdit} onDelete={expenseForm.remove} />
      <div className="maint-fuel-add-row">
        {KINDS.map((item) => (
          <button key={item.value} type="button" className={`maint-fuel-add-btn ${KIND_ADD_CLASS[item.value]}`} onClick={() => onAdd(item.value)}>+ {item.label} 추가</button>
        ))}
      </div>
      <InlineSheet
        open={expenseForm.kindPick || expenseForm.modalOpen}
        forceInstant={callFormOpen}
        className="maint-fuel-inline-host"
        scrollKey={expenseForm.kindPick ? 'pick' : expenseForm.editingId ?? `new-${expenseForm.draft.kind}`}
      >
        {expenseForm.kindPick && <ExpenseSelectPanel onPick={onAdd} />}
        {expenseForm.modalOpen && (
          <ExpenseFormModal
            key={expenseForm.editingId ?? `new-${expenseForm.draft.kind}`}
            inline
            draft={expenseForm.draft}
            editingId={expenseForm.editingId}
            lockDate
            kindLabel={KINDS.find((item) => item.value === expenseForm.draft.kind)?.label || '정비'}
            onChange={expenseForm.setDraft}
            onClose={expenseForm.closeModal}
            onSave={expenseForm.save}
            saving={expenseForm.saving}
          />
        )}
      </InlineSheet>
    </div>
  )
}
