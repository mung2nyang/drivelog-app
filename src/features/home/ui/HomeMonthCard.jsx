// @ts-check
import { formatWon } from '../../../domain/money.ts'

/**
 * @param {Object} props
 * @param {number} props.total
 * @param {number} props.expenseTotal
 * @param {() => void} props.onOpenCalendar
 */
export default function HomeMonthCard({ total, expenseTotal, onOpenCalendar }) {
  return (
    <button type="button" className="home-card home-month-card" onClick={onOpenCalendar}>
      <span className="home-month-copy">
        {expenseTotal > 0 && (
          <span className="home-month-expense">이번 달 지출 합계 <strong>{formatWon(expenseTotal)}</strong></span>
        )}
        <span className="home-card-label">이번 달 정산 합계</span>
        <strong className="home-month-total">{formatWon(total)}</strong>
      </span>
      <span className="home-month-link">달력에서 보기 ›</span>
    </button>
  )
}
