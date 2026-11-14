import { DateNav } from './RevenueNav.tsx'
import { won } from './revenueFormat.ts'
import type { useRevenuePeriod } from './revenuePeriod.ts'
import type { ReactNode } from 'react'

export function RevenuePeriodBar({ period, children }: { period: ReturnType<typeof useRevenuePeriod>, children?: ReactNode }) {
  const { yearly, viewDate, year, month, setViewDate, setTab, shift } = period
  return (
    <div className="revenue-top-card">
      <div className="maint-fuel-nav">
        <DateNav yearly={yearly} viewDate={viewDate} year={year} month={month} onViewDate={setViewDate} onShift={shift} />
      </div>
      <div className="settings-segmented-control maint-fuel-tabs">
        <button type="button" className={`toggle-btn${yearly ? ' active-work' : ''}`} onClick={() => setTab('yearly')}>년 매출</button>
        <button type="button" className={`toggle-btn${!yearly ? ' active-work' : ''}`} onClick={() => setTab('monthly')}>월 매출</button>
      </div>
      {children}
    </div>
  )
}

export function RevenueYearList({ year, rows }: { year: number, rows: Array<{ month: number, netProfit: number }> }) {
  const yearNet = rows.reduce((sum, row) => sum + row.netProfit, 0)
  return (
    <>
      <div className="revenue-year-list">
        {rows.map((row) => (
          <div key={row.month} className="revenue-year-row">
            <span>{row.month}월</span>
            <span className={row.netProfit < 0 ? 'negative' : ''}>{won(row.netProfit)}</span>
          </div>
        ))}
      </div>
      <div className="revenue-year-total">
        <span>{year}년 순이익 합계</span>
        <strong className={yearNet < 0 ? 'negative' : ''}>{won(yearNet)}</strong>
      </div>
    </>
  )
}
