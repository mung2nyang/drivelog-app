// @ts-check
import { formatWon } from '../../../domain/money.ts'

/** @typedef {{ key: string, label: string, main: boolean, count: number, total: number }} UnpaidRow */

/**
 * @param {Object} props
 * @param {boolean} props.inspectionMissing
 * @param {UnpaidRow[]} props.unpaidRows
 * @param {() => void} props.onOpenInspection
 * @param {() => void} props.onOpenReceivables
 */
export default function HomeTodoCard({ inspectionMissing, unpaidRows, onOpenInspection, onOpenReceivables }) {
  if (!inspectionMissing && unpaidRows.length === 0) {
    return <section className="home-card home-todo-empty" aria-label="할 일">할 일 없음</section>
  }
  return (
    <section className="home-card home-todo-card" aria-label="할 일">
      <p className="home-card-label">할 일</p>
      {inspectionMissing && (
        <button type="button" className="home-todo-row" onClick={onOpenInspection}>
          <span>오늘 일상점검표 미작성</span><span className="home-row-arrow" aria-hidden="true">›</span>
        </button>
      )}
      {unpaidRows.map((row) => (
        <button key={row.key} type="button" className="home-todo-row" onClick={onOpenReceivables}>
          <span className="home-todo-text">
            {row.label && <span className={`management-badge${row.main ? ' main' : ''}`}>{row.label}</span>}
            미수금 {row.count}건 {formatWon(row.total)}
          </span>
          <span className="home-row-arrow" aria-hidden="true">›</span>
        </button>
      ))}
    </section>
  )
}
