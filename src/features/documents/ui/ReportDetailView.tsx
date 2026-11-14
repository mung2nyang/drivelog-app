import { formatWon } from '../../../domain/money.ts'
import { dash } from '../api/report.ts'
import AppDropdown from '../../../shared/ui/AppDropdown.tsx'
import './report.css'
import './report-pdf-export.css'
import ModalShell from '../../../shared/ui/ModalShell.tsx'

export type DetailReportItem = {
  dateStr: string
  loadLoc: string
  unloadLoc: string
  client: string
  fare: number
}

export type DetailReport = {
  items: Array<DetailReportItem>
  defaultBaseFare: number
  monthFareByClient: Record<string, number>
  monthCommByClient: Record<string, number>
  clientCommLabels: Record<string, string>
  vat: number
  grandTotal: number
}

type ReportClientPickerModalProps = {
  open: boolean
  options: Array<string>
  value: string
  onChange: (next: string) => void
  onConfirm: () => void
  onClose: () => void
}

export function ReportClientPickerModal({ open, options, value, onChange, onConfirm, onClose }: ReportClientPickerModalProps) {
  if (!open) return null
  return (
    <ModalShell onClose={onClose} contentClassName="modal-content report-picker-modal" label="세부 내역서 조회">
      <div className="modal-title">세부 내역서 조회</div>
      <div className="form-group">
        <label>거래처</label>
        <AppDropdown
          label="거래처"
          value={value}
          options={options.map((option) => ({
            value: option,
            label: option === 'ALL' ? '전체 (모두)' : option,
          }))}
          onChange={onChange}
          className="app-dropdown-boxed"
        />
      </div>
      <div className="modal-btns">
        <button type="button" className="modal-btn cancel" onClick={onClose}>취소</button>
        <button type="button" className="modal-btn confirm" onClick={onConfirm}>조회</button>
      </div>
    </ModalShell>
  )
}

type ReportDetailContentProps = {
  report: DetailReport
  clientFilter: string
  showClientColumn: boolean
  profile: { name?: string, phone?: string, bankName?: string, accountNumber?: string, accountHolder?: string }
  car: { number?: string, tonnage?: string }|null
}

export default function ReportDetailContent({ report, clientFilter, showClientColumn, profile, car }: ReportDetailContentProps) {
  const clientKeys = Object.keys(report.monthFareByClient)
  const showDefaultBase = report.defaultBaseFare > 0 || clientKeys.length === 0
  const filterLabel = clientFilter === 'ALL' ? '전체' : clientFilter

  return (
    <>
      <table className="info-table">
        <tbody>
          <tr>
            <th>성명</th>
            <td>{dash(profile?.name)}</td>
            <th>연락처</th>
            <td>{dash(profile?.phone)}</td>
          </tr>
          <tr>
            <th>차량번호</th>
            <td>{dash(car?.number)}</td>
            <th>차량 톤수</th>
            <td>{dash(car?.tonnage)}</td>
          </tr>
          <tr>
            <th>입금 은행</th>
            <td>{dash(profile?.bankName)}</td>
            <th>예금주</th>
            <td>{dash(profile?.accountHolder)}</td>
          </tr>
          <tr>
            <th>계좌번호</th>
            <td colSpan={3}>{dash(profile?.accountNumber)}</td>
          </tr>
        </tbody>
      </table>
      <table className="report-table detail-report-table">
        <thead>
          <tr>
            <th className="detail-date-cell">날짜</th>
            <th className="detail-text-cell detail-location-cell">상차지</th>
            <th className="detail-text-cell detail-location-cell">하차지</th>
            {showClientColumn && <th className="detail-text-cell">거래처</th>}
            <th className="detail-amount-cell">금액</th>
          </tr>
        </thead>
        <tbody>
          {report.items.length > 0 ? report.items.map((item, index) => (
            <tr key={`${item.dateStr}-${item.client}-${index}`}>
              <td className="detail-date-cell">{item.dateStr}</td>
              <td className="detail-text-cell detail-location-cell">{item.loadLoc}</td>
              <td className="detail-text-cell detail-location-cell">{item.unloadLoc}</td>
              {showClientColumn && <td className="detail-text-cell">{item.client}</td>}
              <td className="amount detail-amount-cell">{item.fare.toLocaleString('ko-KR')}원</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={showClientColumn ? 5 : 4} style={{ textAlign: 'center', padding: 15 }}>
                해당 내역이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="summary-card">
        <div className="summary-title">
          <span>세부 운송료 정산 ({filterLabel})</span>
          <span>총 {report.items.length}회 운행</span>
        </div>
        {showDefaultBase && (
          <div className="summary-row">
            <span>미지정 거래처 운송료</span>
            <span className="summary-value">{formatWon(report.defaultBaseFare)}</span>
          </div>
        )}
        {clientKeys.map((client) => (
          <div key={client}>
            <div className="summary-row">
              <span>{client} 기본 운송료</span>
              <span className="summary-value">{formatWon(report.monthFareByClient[client])}</span>
            </div>
            {(report.monthCommByClient[client] || 0) > 0 && (
              <div className="summary-row summary-row-indent">
                <span>└ {client} 수수료 ({report.clientCommLabels[client]})</span>
                <span className="summary-value">- {formatWon(report.monthCommByClient[client])}</span>
              </div>
            )}
          </div>
        ))}
        <div className="summary-row">
          <span>부가세 (공급가액 기준 10%)</span>
          <span className="summary-value">{formatWon(report.vat)}</span>
        </div>
        <div className="summary-row total">
          <span>계</span>
          <span className="summary-value">{formatWon(report.grandTotal)}</span>
        </div>
      </div>
    </>
  )
}
