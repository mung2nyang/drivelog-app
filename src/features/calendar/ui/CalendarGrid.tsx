import { dayExpenseBadgeLabel, dayHasUnpaid, dayWorkBadgeLabel } from '../../../domain/calendarBadges.ts'
import { isOffDay } from '../../../domain/day-record.ts'
import CalendarCell from './CalendarCell.tsx'
import type { DayRecordLike } from '../../../domain/calendarBadges.ts'
import type { ExpenseItem } from '../../../domain/expenseTypes.ts'
import type { CalendarCellData } from './CalendarCell.tsx'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

type CalendarGridProps = {
  cells: Array<CalendarCellData>
  month: number
  workData: Record<string, DayRecordLike>
  inputMode: 'count'|'fare'
  unitPrice: number|string
  palletPrice: number
  paymentOn: boolean
  expenses?: Array<ExpenseItem>
  expenseVehicle?: string
  onSelectDay: (sel: { dateKey: string, month: number, day: number }) => void
}

export default function CalendarGrid({ cells, month, workData, inputMode, unitPrice, palletPrice, paymentOn, expenses, expenseVehicle, onSelectDay }: CalendarGridProps) {
  return (
    <div className="calendar-grid">
      {WEEKDAYS.map((label, index) => (
        <div
          key={label}
          className={`day-header${index === 0 ? ' sunday' : ''}${index === 6 ? ' saturday' : ''}`}
        >
          {label}
        </div>
      ))}
      {cells.map((cell) => {
        const record = cell.empty ? null : workData[cell.key]
        return (
          <CalendarCell
            key={cell.key}
            cell={cell}
            isOff={isOffDay(record)}
            badgeLabel={dayWorkBadgeLabel(record, { inputMode, unitPrice, palletPrice })}
            expenseBadgeLabel={cell.empty ? null : dayExpenseBadgeLabel(expenses, cell.key, expenseVehicle)}
            hasUnpaid={dayHasUnpaid(record, paymentOn)}
            onSelect={() => onSelectDay({ dateKey: cell.key, month, day: cell.day as number })}
          />
        )
      })}
    </div>
  )
}
