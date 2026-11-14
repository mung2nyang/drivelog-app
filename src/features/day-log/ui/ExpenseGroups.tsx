import { KINDS, expenseTitle, fuelAmountUnit } from '../../../domain/expenses.ts'
import { formatWon, parseCurrencyValue } from '../../../domain/money.ts'
import { ExpenseIcon, EditIcon, DeleteIcon } from '../../../shared/ui/icons.tsx'
import type { ExpenseItem } from './dayLogTypes.ts'

const KIND_TITLE_CLASS: Record<string, string> = { maint: 'maint-title-color', fuel: 'fuel-title-color', misc: 'misc-title-color' }

type ExpenseGroupsProps = {
  dayExpenses: Array<ExpenseItem>
  onEdit: (item: ExpenseItem) => void
  onDelete: (id: string) => void
}

export default function ExpenseGroups({ dayExpenses, onEdit, onDelete }: ExpenseGroupsProps) {
  const groups = KINDS
    .map((kindItem) => {
      const items = dayExpenses.filter((item) => item.kind === kindItem.value)
      return { kindItem, items, total: items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0) }
    })
    .filter((group) => group.items.length > 0)
  if (groups.length === 0) return null

  return (
    <>
      <div className="work-log-expense-group">
        {groups.flatMap(({ kindItem, items }) => items.map((item) => (
          <div key={item.id} className="maint-fuel-item">
            <div className="maint-fuel-head">
              <div className={`maint-fuel-title ${KIND_TITLE_CLASS[kindItem.value]}`}>
                <ExpenseIcon kind={kindItem.value as 'maint'|'fuel'|'misc'} />
                <strong>{expenseTitle(item, kindItem.label)}</strong>
              </div>
              <div className="maint-fuel-actions">
                <button type="button" className="action-icon-btn" title="수정" onClick={() => onEdit(item)}><EditIcon /></button>
                <button type="button" className="action-icon-btn del" title="삭제" onClick={() => onDelete(item.id)}><DeleteIcon /></button>
              </div>
            </div>
            <div className="maint-fuel-info">
              <div>
                {item.kind === 'fuel'
                  ? (item.liters ? <span className="maint-fuel-note">{item.liters}{fuelAmountUnit(item.fuelType)}</span> : null)
                  : <span className="maint-payment-badge">{item.payment || '카드'}</span>}
                {item.kind === 'fuel' && parseCurrencyValue(item.subsidy) > 0 && (
                  <span className="maint-payment-badge">유가보조금 {formatWon(item.subsidy)}</span>
                )}
              </div>
              <strong>{formatWon(item.cost)}</strong>
            </div>
          </div>
        )))}
      </div>
      <div className="call-detail-daily-summary expense-daily-summary">
        {groups.map(({ kindItem, total }) => (
          <div key={kindItem.value}>
            <b>{kindItem.label} 지출 합계</b>
            <strong>{formatWon(total)}</strong>
          </div>
        ))}
        <div className="summary-grand-total">
          <b>지출 합계</b>
          <strong>{formatWon(groups.reduce((sum, group) => sum + group.total, 0))}</strong>
        </div>
      </div>
    </>
  )
}
