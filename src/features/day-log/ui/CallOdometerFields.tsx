import { computeDistanceKm } from '../../../domain/call-details.ts'
import CurrencyInput from '../../../shared/ui/CurrencyInput.tsx'
import FieldError, { invalidProps } from '../../../shared/ui/FieldError.tsx'
import type { emptyDraft } from './callDetailFormHelpers.ts'

export type CallDetailDraft = typeof emptyDraft

export default function CallOdometerFields({ draft, setDraft }: { draft: CallDetailDraft, setDraft: (next: CallDetailDraft) => void }) {
  const distancePreview = computeDistanceKm(draft.startOdometer, draft.endOdometer)
  const problem = draft.startOdometer && draft.endOdometer && !distancePreview
    ? { field: 'endOdometer', message: '마감 계기판이 출발 계기판보다 작습니다.' }
    : null
  return (
    <div className="call-detail-panel call-two-column-panel">
      <div className="form-group">
        <label htmlFor="callStartOdometer">출발 계기판</label>
        <div className="input-with-suffix">
          <CurrencyInput id="callStartOdometer" className="input-box" placeholder="출발 계기판" value={draft.startOdometer} onValueChange={(startOdometer) => setDraft({ ...draft, startOdometer })} />
          <span className="suffix">km</span>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="callEndOdometer">마감 계기판</label>
        <div className="input-with-suffix">
          <CurrencyInput id="callEndOdometer" className="input-box" placeholder="마감 계기판" value={draft.endOdometer} onValueChange={(endOdometer) => setDraft({ ...draft, endOdometer })} {...invalidProps(problem, 'endOdometer', 'callEndOdometer')} />
          <span className="suffix">km</span>
        </div>
        <FieldError problem={problem} field="endOdometer" inputId="callEndOdometer" />
      </div>
      {distancePreview && <p className="billing-settings-note">운행거리 {distancePreview}km</p>}
    </div>
  )
}
