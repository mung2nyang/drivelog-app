import { formatWon } from '../../../domain/money.ts'
import SummaryInfoToggle from '../../../shared/ui/SummaryInfoToggle.tsx'
import type { monthSettlementSummary } from '../../../domain/monthSettlement.ts'

export type MonthSettlementSummary = ReturnType<typeof monthSettlementSummary>

const TOTAL_INFO = '부가세 제외 합계는 운송료와 파렛트 회수 청구액에서 수수료와 산재보험료를 뺀 금액이고, 부가세 포함 합계는 여기에 부가세를 더한 금액입니다. 아래 정비비, 주유비, 통행료는 이 합계에서 차감하지 않은 이번 달 차량 지출입니다.'

function perTripSetting(setting: string) {
  return setting.endsWith('%') || setting.startsWith('건당') ? setting : `건당 ${setting}`
}

function clientCommInfo(setting: string) {
  const shown = setting ? `(${perTripSetting(setting)})` : ''
  return `거래처를 등록할 때 설정한 수수료${shown}를 이 거래처의 운송료에서 차감합니다.`
}

function subCarCommInfo(label: string, base: 'gross'|'afterClientCommission') {
  const setting = label.replace(/^\S+ 차량 (?=\d)/, '')
  const shown = setting && setting !== label ? `(${setting})` : ''
  const from = base === 'afterClientCommission' ? '거래처 수수료를 뺀 운송료에서' : '운송료 전체에서'
  return `차량 관리에서 설정한 이 차량의 수수료${shown}입니다. ${from} 계산해 차감합니다.`
}

type CalendarMonthSummaryProps = {
  paymentOn: boolean
  unpaidTotal: number
  summary: MonthSettlementSummary
  distanceOn?: boolean
}

export default function CalendarMonthSummary({ paymentOn, unpaidTotal, summary, distanceOn = false }: CalendarMonthSummaryProps) {
  const clientNames = Object.keys(summary.fareByClient || {})
  const firstExpense = summary.maint > 0 ? 'maint' : summary.fuel > 0 ? 'fuel' : 'misc'
  const expenseRow = (kind: string, color: string) => (kind === firstExpense
    ? { className: 'summary-row summary-expense-first', style: { marginTop: 8, paddingTop: 8, color } }
    : { className: 'summary-row', style: { color } })
  return (
    <>
      {paymentOn && unpaidTotal > 0 && (
        <>
        <div className="unpaid-summary-card">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          이번 달 미수금 {unpaidTotal.toLocaleString()}원이 있습니다.
        </div>
        <p className="unpaid-dot-legend"><span className="unpaid-dot-legend-mark" aria-hidden="true" />미수금</p>
        </>
      )}

      <div className="summary-card">
        <div className="summary-title">
          <span>월간 운송료 정산</span>
          <span>총 {summary.trips + summary.callTrips}회 운행</span>
        </div>

        {distanceOn && summary.distanceKm > 0 && (
          <div className="summary-row">
            <span>실 운행거리</span>
            <span className="summary-value">{summary.distanceKm} km</span>
          </div>
        )}

        {summary.fixedBaseFare > 0 && (
          <div className="summary-row">
            <span>고정 기본 운송료</span>
            <span className="summary-value">{formatWon(summary.fixedBaseFare)}</span>
          </div>
        )}
        {summary.defaultBaseFare > 0 && (
          <div className="summary-row">
            <span>미지정 거래처 운송료</span>
            <span className="summary-value">{formatWon(summary.defaultBaseFare)}</span>
          </div>
        )}
        {clientNames.map((client) => (
          <div key={client}>
            <div className="summary-row">
              <span>{client} 기본 운송료</span>
              <span className="summary-value">{formatWon(summary.fareByClient[client])}</span>
            </div>
            {(summary.commissionByClient[client] || 0) > 0 && (
              <SummaryInfoToggle
                className="summary-row summary-client-commission-row"
                labelClassName="summary-client-commission-label"
                label={`${client} 수수료 (${summary.commissionLabelByClient[client]})`}
                value={`- ${formatWon(summary.commissionByClient[client])}`}
                infoName={`${client} 수수료`}
                info={clientCommInfo(String(summary.commissionLabelByClient[client] || ''))}
              />
            )}
          </div>
        ))}

        {summary.subCarComm > 0 && (
          <SummaryInfoToggle
            className="summary-row"
            label={summary.subCarCommLabel}
            value={`- ${formatWon(summary.subCarComm)}`}
            infoName="기사 차량 수수료"
            info={subCarCommInfo(summary.subCarCommLabel, summary.subCarCommBase)}
          />
        )}
        {summary.palletFare > 0 && (
          <div className="summary-row">
            <span>파렛트 회수 청구액</span>
            <span className="summary-value">{formatWon(summary.palletFare)}</span>
          </div>
        )}

        {summary.insuranceTotal > 0 && (
          <div className="summary-row">
            <span>산재보험료</span>
            <span className="summary-value">- {formatWon(summary.insuranceTotal)}</span>
          </div>
        )}
        <div className="summary-row summary-subtotal">
          <span>합계 (부가세 제외)</span>
          <span className="summary-value">{formatWon(summary.total - summary.vat)}</span>
        </div>
        <div className="summary-row">
          <span>부가세 (공급가액 기준 10%)</span>
          <span className="summary-value">{formatWon(summary.vat)}</span>
        </div>
        <SummaryInfoToggle className="summary-row total" label={<>합계 <span className="summary-total-vat">(부가세 포함)</span></>} value={formatWon(summary.total)} infoName="합계" info={TOTAL_INFO} />

        {summary.maint > 0 && (
          <div {...expenseRow('maint', 'var(--sunday-color)')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg className="inline-icon sm" viewBox="0 0 24 24">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
              차량 정비비
            </span>
            <span className="summary-value">{formatWon(summary.maint)}</span>
          </div>
        )}
        {summary.fuel > 0 && (
          <div {...expenseRow('fuel', 'var(--primary-color)')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg className="inline-icon sm" viewBox="0 0 24 24" aria-hidden="true">
                <line x1="3" x2="15" y1="22" y2="22"></line>
                <line x1="4" x2="14" y1="9" y2="9"></line>
                <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"></path>
                <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.83a2 2 0 0 0-.59-1.42L18 5"></path>
              </svg>
              차량 주유비
            </span>
            <span className="summary-value">{formatWon(summary.fuel)}</span>
          </div>
        )}
        {summary.misc > 0 && (
          <div {...expenseRow('misc', 'var(--sunday-color)')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg className="inline-icon sm" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18"></path>
              </svg>
              통행료/기타
            </span>
            <span className="summary-value">{formatWon(summary.misc)}</span>
          </div>
        )}
      </div>
    </>
  )
}
