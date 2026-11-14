export type CalendarCellData = {
  key: string
  day?: number
  empty?: boolean
  sunday?: boolean
  saturday?: boolean
  today?: boolean
}

type CalendarCellProps = {
  cell: CalendarCellData
  badgeLabel: string|null
  expenseBadgeLabel?: string|null
  isOff: boolean
  hasUnpaid: boolean
  onSelect: (cell: CalendarCellData) => void
}

export default function CalendarCell({ cell, badgeLabel, expenseBadgeLabel, isOff, hasUnpaid, onSelect }: CalendarCellProps) {
  return (
    <button
      type="button"
      disabled={cell.empty}
      className={[
        'date-cell',
        cell.empty ? 'empty' : '',
        cell.sunday ? 'sunday' : '',
        cell.saturday ? 'saturday' : '',
        cell.today ? 'today' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => {
        if (cell.empty) return
        onSelect(cell)
      }}
    >
      {!cell.empty && <span className="cell-date-text">{cell.day}</span>}
      {isOff && <span className="off-badge">휴무</span>}
      {!isOff && badgeLabel && <span className="work-badge">{badgeLabel}</span>}
      {expenseBadgeLabel && <span className="maint-badge">{expenseBadgeLabel}</span>}
      {hasUnpaid && <span className="unpaid-dot" aria-hidden="true" />}
    </button>
  )
}
