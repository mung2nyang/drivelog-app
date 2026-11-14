import { callFareTotal, callVatTotal } from '../../../domain/day-record.ts'
import { callInsuranceTotal } from '../../../domain/call-details.ts'
import { getDetailPaymentSummary } from '../../../domain/finance.ts'
import { commissionInfo } from './callDetailFormHelpers.ts'
import CallDetailCard from './CallDetailCard.tsx'
import './call-detail-list.css'
import type { CallDetailLike, ClientLike, PaymentSummary, Settings } from './dayLogTypes.ts'
import type { ReactNode } from 'react'

type CallDetailListProps = {
  details: Array<CallDetailLike>
  settings: Settings
  clients: Array<ClientLike>
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onTogglePayment: (id: string) => void
  onMessage: (id: string) => void
  canAdd?: boolean
  onAdd: () => void
  children?: ReactNode
}

export default function CallDetailList({ details, settings, clients, canAdd = true, onEdit, onDelete, onTogglePayment, onMessage, onAdd, children }: CallDetailListProps) {
  const callFare = callFareTotal({ isOff: false, callDetails: details })
  const callVat = callVatTotal({ isOff: false, callDetails: details })
  const totalDistance = details.reduce((sum, item) => sum + (parseFloat(item.distanceKm || '') || 0), 0)
  const totalCommission = details.reduce((sum, item) => sum + commissionInfo(item).amount, 0)
  const totalInsuranceFee = callInsuranceTotal({ isOff: false, callDetails: details })
  const grandTotal = callFare - totalCommission - totalInsuranceFee + callVat

  return (
    <div className="modal-section call-detail-section">
      <div className="modal-section-title">
        <span>운행일지 세부 입력</span>
        {canAdd && (
          <button type="button" className="compact-add-btn" onClick={onAdd}>+ 추가</button>
        )}
      </div>
      {details.map((item) => (
        <CallDetailCard
          key={item.id}
          item={item}
          payment={getDetailPaymentSummary(item) as PaymentSummary}
          settings={settings}
          client={clients.find((entry) => entry.companyName === item.client)}
          onEdit={() => onEdit(item.id)}
          onDelete={() => onDelete(item.id)}
          onTogglePayment={() => onTogglePayment(item.id)}
          onMessage={() => onMessage(item.id)}
        />
      ))}
      {details.length > 0 && (
        <div className="call-detail-daily-summary">
          <div><b>일일 운행거리</b><strong>{totalDistance} km</strong></div>
          {totalCommission > 0 && (
            <div className="commission-row"><b>수수료</b><strong>- {totalCommission.toLocaleString('ko-KR')}원</strong></div>
          )}
          {totalInsuranceFee > 0 && (
            <div className="commission-row"><b>산재보험료</b><strong>- {totalInsuranceFee.toLocaleString('ko-KR')}원</strong></div>
          )}
          <div><b>부가세(공급가액 기준 10%)</b><strong>{callVat.toLocaleString('ko-KR')}원</strong></div>
          <div className="summary-grand-total">
            <b>세부 내역 합계 ({details.length}건)</b>
            <strong>{grandTotal.toLocaleString('ko-KR')}원</strong>
          </div>
        </div>
      )}
      {canAdd && (
        <div className="call-detail-add-row">
          <button type="button" className="call-detail-add-btn" onClick={onAdd}>+ 세부 내역 추가</button>
        </div>
      )}
      {children}
    </div>
  )
}
