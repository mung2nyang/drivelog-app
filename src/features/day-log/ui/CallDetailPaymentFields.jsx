// @ts-check
// 콜상세 입력의 돈 관련 칸(계산서·입금 예정일, 부가세 없음, 산재보험료).
import CurrencyInput from '../../../shared/ui/CurrencyInput.jsx'
import TemporalInput from '../../../shared/ui/TemporalInput.jsx'
import InfoTip from '../../../shared/ui/InfoTip.jsx'
import './call-detail-payment.css'

const RECEIPT_PRESETS = ['전자', '일반', '카드', '현금', '송금']
// 예시는 줄 안 나뉘는 띄어쓰기로 한 덩어리.
const VAT_INPUT_INFO = '부가가치세가 포함된 금액이라면 1.1로 나눈 공급가액을 입력해 주세요.\n(예:\u00a0110,000원\u00a0→\u00a0100,000원)'

/** @typedef {typeof import('./callDetailFormHelpers.js').emptyDraft} CallDetailDraft 폼 입력 중 초안(CallDetailForm 상태와 같은 모양) */

/**
 * @param {Object} props
 * @param {CallDetailDraft} props.draft
 * @param {(next: CallDetailDraft) => void} props.setDraft
 * @param {string} props.paymentGuide 입금 예정일 아래 안내(거래처 결제 조건)
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
 * 운송료 바로 아래 한 줄 — 작은 "부가세 없음(면세)" 체크 칸 + (i) 공급가액 안내 + 오른쪽 끝 부가세 미리보기.
 * @param {Object} props
 * @param {CallDetailDraft} props.draft
 * @param {(next: CallDetailDraft) => void} props.setDraft
 * @param {string} props.preview 운송료가 없으면 빈 글
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
