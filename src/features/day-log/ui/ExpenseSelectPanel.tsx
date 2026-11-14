import { KINDS } from '../../../domain/expenses.ts'

export default function ExpenseSelectPanel({ onPick }: { onPick: (kind: string) => void }) {
  return (
    <div className="modal-content maint-fuel-select-inline">
      <div className="expense-kind-pick">
        {KINDS.map((item) => (
          <button key={item.value} type="button" className="modal-btn confirm" onClick={() => onPick(item.value)}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
