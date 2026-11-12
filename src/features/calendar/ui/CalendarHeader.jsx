// @ts-check
import AppTopBar from '../../../shared/ui/AppTopBar.tsx'
import CalendarDateSelect from '../../../shared/ui/CalendarDateSelect.tsx'

/**
 * @param {Object} props
 * @param {number} props.year
 * @param {number} props.month
 * @param {Array<number>} props.yearOptions
 * @param {(year: number, month: number) => void} props.onChangeMonth
 * @param {(() => void)} [props.onOpenMenu]
 * @param {import('react').ReactNode} [props.banner]
 */
export default function CalendarHeader({
  year,
  month,
  yearOptions,
  onChangeMonth,
  onOpenMenu,
  banner,
}) {
  return (
    <>
      <AppTopBar onOpenMenu={onOpenMenu} />
      {banner}
      <div className="header">
        <div className="date-navigator">
          <button type="button" className="arrow-btn" title="이전 달" onClick={() => onChangeMonth(year, month - 1)}>
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>

          <div className="date-select-group">
            <CalendarDateSelect
              label="년도 선택"
              value={year}
              options={yearOptions.map((y) => ({ value: String(y), label: `${y}년` }))}
              onChange={(next) => onChangeMonth(Number(next), month)}
            />
            <CalendarDateSelect
              label="월 선택"
              value={month}
              options={Array.from({ length: 12 }, (_, m) => ({ value: String(m), label: `${m + 1}월` }))}
              onChange={(next) => onChangeMonth(year, Number(next))}
            />
          </div>

          <button type="button" className="arrow-btn" title="다음 달" onClick={() => onChangeMonth(year, month + 1)}>
            <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      </div>
    </>
  )
}
