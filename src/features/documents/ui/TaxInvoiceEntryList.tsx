import { useState } from 'react'
import { formatWon } from '../../../domain/money.ts'
import ConfirmModal from '../../../shared/ui/ConfirmModal.tsx'
import './tax-invoice.css'
import type { InvoiceLike } from '../../../domain/financeTaxInvoiceEntries.ts'

const HOMETAX_ISSUE_URL = 'https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&tmIdx=46&tm2lIdx=4601010000&tm3lIdx=4601010500'

function hasFullPartyInfo(item: InvoiceLike) {
  return [item.clientBizNumber, item.clientRepresentative, item.clientAddress, item.clientBizType, item.clientBizItem, item.clientEmail]
    .every((value) => String(value || '').trim() !== '')
}

type TaxInvoiceEntryListProps = {
  entries: Array<InvoiceLike>
  tab: 'draft'|'issued'
  emptyDraft: string
  flowMeta: { completeLabel: string }
  onOpenDraft: (item: InvoiceLike) => void
  onExportExcel?: (item: InvoiceLike) => void
  onChangeStatus: (item: InvoiceLike, status: 'draft'|'issued') => void
}

export default function TaxInvoiceEntryList({
  entries, tab, emptyDraft, flowMeta, onOpenDraft, onExportExcel, onChangeStatus,
}: TaxInvoiceEntryListProps) {
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set())
  const goHometax = (id: string) => {
    window.open(HOMETAX_ISSUE_URL, '_blank', 'noopener')
    setVisitedIds((prev) => new Set(prev).add(id))
  }
  const [excelItem, setExcelItem] = useState<InvoiceLike|null>(null)
  if (entries.length === 0) {
    return (
      <div className="empty-state">
        {tab === 'issued' ? `${flowMeta.completeLabel} 내역이 없습니다.` : emptyDraft}
      </div>
    )
  }
  return (
    <>
      {entries.map((item) => (
        <div key={item.id} className="tax-invoice-entry-card">
          <div className="tax-invoice-entry-head">
            <strong>{item.clientName}</strong>
            <span className="management-badge">
              {tab === 'issued' ? flowMeta.completeLabel : '작성 전'}
            </span>
          </div>
          <div className="car-sub-text">{item.count || 0}건, {item.clientBizNumber || '사업자등록번호 미입력'}</div>
          {item.vehicleLabel && <div className="car-sub-text">{item.vehicleLabel}</div>}
          <div className="tax-invoice-amount-box">
            <div className="tax-invoice-amount-row">
              <span>공급가액 {formatWon(item.supplyAmount)}</span>
              <span>세액 {formatWon(item.taxAmount)}</span>
            </div>
            <div className="tax-invoice-amount-row total">
              <span>합계</span>
              <strong>{formatWon(item.totalAmount)}</strong>
            </div>
          </div>
          <div className="tax-invoice-entry-actions">
            <button type="button" className="tax-invoice-action-btn" onClick={() => onOpenDraft(item)}>
              {item.status === 'issued' ? '내용 보기' : (hasFullPartyInfo(item) ? '수정하기' : '작성하기')}
            </button>
            <button type="button" className="tax-invoice-action-btn" onClick={() => setExcelItem(item)}>엑셀 저장</button>
            {item.status === 'issued'
              ? <button type="button" className="tax-invoice-action-btn danger" onClick={() => onChangeStatus(item, 'draft')}>발급 취소</button>
              : visitedIds.has(item.id)
                ? <button type="button" className="tax-invoice-action-btn primary" onClick={() => onChangeStatus(item, 'issued')}>{flowMeta.completeLabel}</button>
                : <button type="button" className="tax-invoice-action-btn primary" onClick={() => goHometax(item.id)}>발급하러 가기</button>}
          </div>
        </div>
      ))}
      {excelItem && (
        <ConfirmModal
          title="엑셀 저장"
          message="엑셀로 저장하시겠습니까?"
          confirmLabel="저장"
          onCancel={() => setExcelItem(null)}
          onConfirm={() => { setExcelItem(null); onExportExcel?.(excelItem) }}
        />
      )}
    </>
  )
}
