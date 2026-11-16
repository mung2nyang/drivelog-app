import CalendarDateSelect from '../../../shared/ui/CalendarDateSelect.tsx'
import { getYearOptions } from '../../../domain/calendar.ts'
import { formatWon } from '../../../domain/money.ts'
import { getDriverSettlementBreakdown, hasDriverInsuranceShare } from '../../../domain/driverIncomeDeductions.ts'
import type { CarLike } from '../../../domain/financeTypes.ts'

const YEAR_OPTIONS = getYearOptions()

function deductionWon(amount: number) {
  return `${Number(amount) > 0 ? '-' : ''}${formatWon(amount)}`
}

export type SettlementDetail = { tripCount?: number, totalFare?: number, commissionAmount?: number, previousPeriods?: Array<{ label: string, fare: number }>, car?: CarLike }

type SettlementSummaryCardProps = {
  viewDate: Date
  onPrevMonth: () => void
  onNextMonth: () => void
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
  detail: SettlementDetail|null
}

export default function SettlementSummaryCard({
  viewDate, onPrevMonth, onNextMonth, onYearChange, onMonthChange, detail,
}: SettlementSummaryCardProps) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const breakdown = getDriverSettlementBreakdown(detail, detail?.car)
  const showInsurance = hasDriverInsuranceShare(detail?.car)
  const showWithholding = !!detail?.car?.withholdingOn
  return (
    <section className="tax-invoice-summary" id="linkedDriverSettlementSummary">
      <div className="date-navigator" style={{ marginBottom: 12 }}>
        <button type="button" className="arrow-btn" title="이전 달" onClick={onPrevMonth}>
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div className="date-select-group">
          <CalendarDateSelect
            label="년도 선택"
            value={year}
            options={YEAR_OPTIONS.map((y) => ({ value: String(y), label: `${y}년` }))}
            onChange={(next) => onYearChange(Number(next))}
          />
          <CalendarDateSelect
            label="월 선택"
            value={month}
            options={Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: `${i + 1}월` }))}
            onChange={(next) => onMonthChange(Number(next))}
          />
        </div>
        <button type="button" className="arrow-btn" title="다음 달" onClick={onNextMonth}>
          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
      <div className="summary-title"><span>기사 정산</span><span>{detail?.tripCount || 0}건</span></div>
      <div className="summary-row"><span>총 운송료</span><span className="summary-value">{formatWon(breakdown.totalFare)}</span></div>
      {(detail?.previousPeriods || []).map((period) => (
        <div className="summary-row" key={period.label}><span>{period.label}</span><span className="summary-value">{deductionWon(period.fare)}</span></div>
      ))}
      <div className="summary-row"><span>기사 정산금</span><span className="summary-value">{formatWon(breakdown.settlementAmount)}</span></div>
      {showInsurance && <div className="summary-row"><span>산재보험 (기사 몫)</span><span className="summary-value">{deductionWon(breakdown.insuranceDriverShare)}</span></div>}
      {showWithholding && <div className="summary-row"><span>원천징수 (3.3%)</span><span className="summary-value">{deductionWon(breakdown.withholding)}</span></div>}
      <div className="summary-row total"><span>최종 실수령액</span><span className="summary-value">{formatWon(breakdown.driverNet)}</span></div>
    </section>
  )
}
