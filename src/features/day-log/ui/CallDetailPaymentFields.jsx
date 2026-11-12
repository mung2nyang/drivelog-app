// @ts-check
import CurrencyInput from '../../../shared/ui/CurrencyInput.tsx'
import TemporalInput from '../../../shared/ui/TemporalInput.tsx'
import InfoTip from '../../../shared/ui/InfoTip.tsx'
import './call-detail-payment.css'

const RECEIPT_PRESETS = ['전자', '일반', '카드', '현금', '송금']
const VAT_INPUT_INFO = '부가가치세가 포함된 금액이라면 1.1로 나눈 공급가액을 입력해 주세요.\n(예:\u00a0110,000원\u00a0→\u00a0100,000원)'

/** @typedef {typeof import('./callDetailFormHelpers.js').emptyDraft} CallDetailDraft */

/**
 * @param {Object} props
 * @param {CallDetailDraft} props.draft
 * @param {(next: CallDetailDraft) => void} props.setDraft
 * @param {string} props.paymentGuide
 */
export default function CallDetailPaymentFields({ draft, setDraft, paymentGuide }) {
  return (
    <div className="call-detail-panel call-receipt-panel">
      <label>계산서</label>
      <div className="call-receipt-group">
        {RECEIPT_PRESETS.map((name) => (
          <button key={name} type="button" className={`dark-pill-btn${draft.receipt === name ? ' active' : ''}`} onClick={() => setDraft({ ...draft, receipt: draft.receipt === name ? '' : name })}>{name}</button>
        ))}
      </div>
      <div className="payment-due-date-box">
        <div className="form-group">
          <label htmlFor="callPaymentDueDate">입금 예정일</label>
          <TemporalInput type="date" id="callPaymentDueDate" value={draft.paymentDueDate} centered onChange={(e) => setDraft({ ...draft, paymentDueDate: e.target.value })} />
        </div>
        <p className="payment-term-guide">{paymentGuide}</p>
      </div>
    </div>
  )
}

/**
 * @param {Object} props
 * @param {CallDetailDraft} props.draft
 * @param {(next: CallDetailDraft) => void} props.setDraft
 */
export function CallInsuranceFeeField({ draft, setDraft }) {
  return (
    <div className="call-detail-panel">
      <div className="call-inline-field">
        <label htmlFor="callInsuranceFee">산재보험료</label>
        <div className="input-with-suffix">
          <CurrencyInput id="callInsuranceFee" className="input-box" placeholder="금액 입력" value={draft.insuranceFee} onValueChange={(insuranceFee) => setDraft({ ...draft, insuranceFee })} />
          <span className="suffix">원</span>
        </div>
      </div>
    </div>
  )
}

/**
 * @param {Object} props
 * @param {CallDetailDraft} props.draft
 * @param {(next: CallDetailDraft) => void} props.setDraft
 * @param {string} props.preview
 */
export function CallVatExemptRow({ draft, setDraft, preview }) {
  return (
    <div className="call-vat-row">
      <label className="call-vat-check" htmlFor="callVatExempt">
        <input id="callVatExempt" type="checkbox" checked={draft.vatExempt} onChange={(e) => setDraft({ ...draft, vatExempt: e.target.checked })} />
        <span>부가세 없음(면세)</span>
      </label>
      <InfoTip name="부가세 입력" info={VAT_INPUT_INFO} />
      {preview && <span className="call-vat-preview">{preview}</span>}
    </div>
  )
}
