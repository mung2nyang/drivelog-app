// @ts-check

/**
 * @typedef {Object} CalendarCellData
 * @property {string} key
 * @property {number} [day]
 * @property {boolean} [empty]
 * @property {boolean} [sunday]
 * @property {boolean} [saturday]
 * @property {boolean} [today]
 */

/**
 * @param {Object} props
 * @param {CalendarCellData} props.cell
 * @param {string|null} props.badgeLabel
 * @param {string|null} [props.expenseBadgeLabel]
 * @param {boolean} props.isOff
 * @param {boolean} props.hasUnpaid
 * @param {(cell: CalendarCellData) => void} props.onSelect
 */
export default function CalendarCell({ cell, badgeLabel, expenseBadgeLabel, isOff, hasUnpaid, onSelect }) {
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
