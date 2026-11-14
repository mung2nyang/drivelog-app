import './report.css'
import './report-pdf-export.css'
import { ReportMonthSummaryCard } from './ReportMonthSummaryCard.tsx'
import type { JsonValue } from '../../../domain/jsonTypes.ts'
export type ReportDayRow = {
  day: number
  isOff: boolean
  workVal: number
  palletCount: number
  amount: number
}

function ReportDayTable({ days, monthIndex, showPallet }: { days: Array<ReportDayRow>, monthIndex: number, showPallet: boolean }) {
  const monthLabel = monthIndex + 1
  return (
    <table className="report-table">
      <thead>
        <tr>
          <th style={{ width: showPallet ? '30%' : '35%' }}>날짜</th>
          <th style={{ width: showPallet ? '20%' : '25%' }}>운행</th>
          {showPallet && <th style={{ width: '20%' }}>파렛트</th>}
          <th style={{ width: showPallet ? '30%' : '40%' }}>금액</th>
        </tr>
      </thead>
      <tbody>
        {days.map((item) => (
          <tr key={item.day}>
            <td>{monthLabel}월 {item.day}일</td>
            <td>{item.isOff ? '휴무' : `${item.workVal}회`}</td>
            {showPallet && <td>{item.palletCount > 0 ? `${item.palletCount}장` : '-'}</td>}
            <td className="amount">{item.amount.toLocaleString('ko-KR')}원</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function renderSummaryDayTables(days: Array<ReportDayRow>, monthIndex: number, showPallet: boolean, isExporting: boolean) {
  if (!days.length) {
    return (
      <table className="report-table">
        <tbody>
          <tr>
            <td style={{ textAlign: 'center', padding: 15, color: 'var(--sub-text-color)' }}>
              선택한 달의 운송 내역이 없습니다.
            </td>
          </tr>
        </tbody>
      </table>
    )
  }
  if (isExporting) {
    const half = Math.ceil(days.length / 2)
    const left = days.slice(0, half)
    const right = days.slice(half)
    return (
      <div className="report-split-container">
        <div className="report-split-column">
          <ReportDayTable days={left} monthIndex={monthIndex} showPallet={showPallet} />
        </div>
        <div className="report-split-column">
          {right.length > 0
            ? <ReportDayTable days={right} monthIndex={monthIndex} showPallet={showPallet} />
            : null}
        </div>
      </div>
    )
  }
  return <ReportDayTable days={days} monthIndex={monthIndex} showPallet={showPallet} />
}

type ReportSummaryContentProps = {
  profile: { name?: string, phone?: string, bankName?: string, accountNumber?: string, accountHolder?: string }
  car: { number?: string, tonnage?: string }|null
  report: {
    monthIndex: number
    days: Array<ReportDayRow>
    showPallet: boolean
    distanceKm: number
    trips?: number
    callTrips?: number
    fixedBaseFare: number
    defaultBaseFare: number
    fareByClient: Record<string, number>
    commissionByClient: Record<string, number>
    commissionLabelByClient: Record<string, string>
    palletFare?: number
    vat: number
    total: number
  }
  dash: (value: JsonValue|undefined) => string
  formatWon: (value: number|string) => string
  distanceOn?: boolean
  isExporting?: boolean
}

export function ReportSummaryContent({ profile, car, report, dash, formatWon, distanceOn = false, isExporting = false }: ReportSummaryContentProps) {
  const days = Array.isArray(report.days) ? report.days : []
  const showPallet = !!report.showPallet

  return (
    <>
      <table className="info-table">
        <tbody>
          <tr>
            <th>성명</th>
            <td>{dash(profile.name)}</td>
            <th>연락처</th>
            <td>{dash(profile.phone)}</td>
          </tr>
          <tr>
            <th>차량번호</th>
            <td>{dash(car?.number)}</td>
            <th>차량 톤수</th>
            <td>{dash(car?.tonnage)}</td>
          </tr>
          <tr>
            <th>입금 은행</th>
            <td>{dash(profile.bankName)}</td>
            <th>예금주</th>
            <td>{dash(profile.accountHolder)}</td>
          </tr>
          <tr>
            <th>계좌번호</th>
            <td colSpan={3}>{dash(profile.accountNumber)}</td>
          </tr>
        </tbody>
      </table>
      {renderSummaryDayTables(days, report.monthIndex, showPallet, isExporting)}
      <ReportMonthSummaryCard report={report} formatWon={formatWon} distanceOn={distanceOn} />
    </>
  )
}
