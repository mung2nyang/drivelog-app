import { useState } from 'react'
import { dueDateForClient, getClientsForLog, getPaymentTermLabel, pinnedClients } from '../../../domain/clients.ts'
import { parseCurrencyValue, vatOf } from '../../../domain/money.ts'
import { checkCallDetailDraft } from '../../../domain/call-details.ts'
import { normalizePlatformPresets } from '../../../domain/platformPresets.ts'
import { confirmLargeFareSave, draftFromDetail, emptyDraft } from './callDetailFormHelpers.ts'
import LocationShortcuts from './LocationShortcuts.tsx'
import CallClientQuickAdd from './CallClientQuickAdd.tsx'
import CallOdometerFields from './CallOdometerFields.tsx'
import PlatformChips from './PlatformChips.tsx'
import ClearableInput from '../../../shared/ui/ClearableInput.tsx'
import CurrencyInput from '../../../shared/ui/CurrencyInput.tsx'
import TemporalInput from '../../../shared/ui/TemporalInput.tsx'
import FieldError, { focusField, invalidProps } from '../../../shared/ui/FieldError.tsx'
import CallDetailPaymentFields, { CallInsuranceFeeField, CallVatExemptRow } from './CallDetailPaymentFields.tsx'
import './call-detail-form.css'
import './call-detail-inputs.css'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import type { CallDetailDraft } from '../../../domain/call-details.ts'
import type { CallDetailLike, ClientLike, Settings } from './dayLogTypes.ts'

type CallDetailFormProps = {
  value: CallDetailLike|null
  previousItem: CallDetailLike|null
  prefill?: { loadLoc: string, unloadLoc: string, fare: number|null, client: string }|null
  dateKey: string
  clients: Array<ClientLike>
  settings: Settings
  logId?: string
  clientScopeKey?: string
  locationShortcuts?: Array<string>
  pinnedLocations?: Array<string>
  onTogglePinnedLocation?: (location: string) => void
  onRemovePlatform?: (name: string) => void
  onSave: (item: CallDetailDraft) => void
  onClose: () => void
  isEmployedDriver?: boolean
}

export default function CallDetailForm({
  value, previousItem, prefill = null, dateKey, clients, settings, logId, clientScopeKey, onSave, onClose,
  locationShortcuts = [], pinnedLocations = [], onTogglePinnedLocation, onRemovePlatform, isEmployedDriver = false,
}: CallDetailFormProps) {
  const { ownerKey } = useSession()
  const start = value || (prefill && { ...prefill, id: '', fare: prefill.fare ?? '' })
  const [draft, setDraft] = useState(() => (start ? draftFromDetail(start, dateKey, clients) : { ...emptyDraft, paymentDueDate: dueDateForClient(dateKey, null) }))
  const [activeLocationTarget, setActiveLocationTarget] = useState<'load'|'unload'>('load')

  const scopeKey = clientScopeKey || logId
  const scopedClients = getClientsForLog(clients, scopeKey) as Array<ClientLike>
  const shortcuts = pinnedClients(scopedClients) as Array<ClientLike>
  const [problem, setProblem] = useState<ReturnType<typeof checkCallDetailDraft>>(null)
  const shown = problem && checkCallDetailDraft(draft)
  const fareNumber = parseCurrencyValue(draft.fare)
  const vatPreview = !fareNumber
    ? ''
    : draft.vatExempt
      ? '부가세 0원'
      : `부가세 포함 ${(fareNumber + vatOf(fareNumber)).toLocaleString('ko-KR')}원`
  const selectedClient = clients.find((item) => item.companyName === draft.client)
  const paymentGuide = selectedClient
    ? getPaymentTermLabel(selectedClient.paymentTerm, selectedClient.paymentTermValue)
    : '거래처를 선택하면 결제 조건에 따라 자동으로 입력됩니다.'

  async function handleSave() {
    const found = checkCallDetailDraft(draft)
    setProblem(found)
    if (found) {
      focusField('callLoadLoc')
      return
    }
    if (await confirmLargeFareSave(draft.fare)) onSave(draft)
  }

  function applyClient(name: string) {
    const client = clients.find((item) => item.companyName === name)
    setDraft((prev) => ({ ...prev, client: name, paymentDueDate: dueDateForClient(dateKey, client) }))
  }

  return (
    <div className="modal-content call-detail-modal-content">
      <div className="modal-title call-detail-modal-title">{`${Number(dateKey.slice(8, 10))}일 운행일지 세부 내역${value ? ' 수정' : ' 입력'}`}</div>
      {!value && previousItem && (
        <button type="button" className="call-detail-copy-prev-btn" onClick={() => setDraft(draftFromDetail(previousItem, dateKey, clients))}>
          ↺ 이전 내역 불러오기
        </button>
      )}
      <div className="call-detail-panel call-route-panel">
        <div className="form-group">
          <label className="load-label" htmlFor="callLoadLoc">상차지</label>
          <ClearableInput id="callLoadLoc" className="input-box" placeholder="상차지 입력" value={draft.loadLoc} onFocus={() => setActiveLocationTarget('load')} onChange={(e) => setDraft({ ...draft, loadLoc: e.target.value })} {...invalidProps(shown, 'loadLoc', 'callLoadLoc')} />
          <FieldError problem={shown} field="loadLoc" inputId="callLoadLoc" />
        </div>
        <div className="form-group">
          <label className="unload-label" htmlFor="callUnloadLoc">하차지</label>
          <ClearableInput id="callUnloadLoc" className="input-box" placeholder="하차지 입력" value={draft.unloadLoc} onFocus={() => setActiveLocationTarget('unload')} onChange={(e) => setDraft({ ...draft, unloadLoc: e.target.value })} />
        </div>
        <LocationShortcuts
          locations={locationShortcuts}
          pinnedLocations={pinnedLocations}
          onSelect={(location) => setDraft({
            ...draft,
            ...(activeLocationTarget === 'unload' ? { unloadLoc: location } : { loadLoc: location }),
          })}
          onTogglePin={(location) => onTogglePinnedLocation?.(location)}
        />
      </div>
      {settings.cargoTonnageOn && (
        <div className="call-detail-panel">
          <div className="call-inline-field">
            <label htmlFor="callCargoTonnage">화물 톤수</label>
            <div className="input-with-suffix">
              <input id="callCargoTonnage" type="number" className="input-box" inputMode="decimal" min="0" step="0.1" placeholder="선택 입력" value={draft.cargoTonnage} onChange={(e) => setDraft({ ...draft, cargoTonnage: e.target.value })} />
              <span className="suffix">톤</span>
            </div>
          </div>
        </div>
      )}
      <div className="call-detail-panel call-client-panel">
        <label htmlFor="callClient">거래처</label>
        <div className="call-client-row">
          <ClearableInput id="callClient" className="input-box" list="callClientOptions" placeholder="직접 입력 또는 선택" value={draft.client} onChange={(e) => applyClient(e.target.value)} />
          <datalist id="callClientOptions">
            {scopedClients.map((client) => <option key={client.id} value={client.companyName} />)}
          </datalist>
          {ownerKey && (
            <CallClientQuickAdd
              clients={clients}
              logId={scopeKey}
              onClientAdded={applyClient}
            />
          )}
        </div>
        {shortcuts.length > 0 && (
          <div className="call-client-shortcuts">
            {shortcuts.map((client) => (
              <button key={client.id} type="button" className={`dark-pill-btn${draft.client === client.companyName ? ' active' : ''}`} onClick={() => applyClient(draft.client === client.companyName ? '' : client.companyName)}>{client.companyName}</button>
            ))}
          </div>
        )}
      </div>
      <div className="call-detail-panel call-money-panel">
        <div className="call-inline-field">
          <label htmlFor="callFare">운송료<br />(부가세 별도)</label>
          <div className="input-with-suffix">
            <CurrencyInput id="callFare" className="input-box" placeholder="운송료 입력" value={draft.fare} onValueChange={(fare) => setDraft({ ...draft, fare })} />
            <span className="suffix">원</span>
          </div>
        </div>
        <CallVatExemptRow draft={draft} setDraft={setDraft} preview={vatPreview} />
      </div>
      {settings.paymentOn && <CallDetailPaymentFields draft={draft} setDraft={setDraft} paymentGuide={paymentGuide} />}
      {settings.timeOn && (
        <div className="call-detail-panel call-two-column-panel">
          <div className="form-group">
            <label htmlFor="callDepartureTime">출발 시간</label>
            <TemporalInput type="time" id="callDepartureTime" clearable value={draft.departureTime} centered onChange={(e) => setDraft({ ...draft, departureTime: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="callArrivalTime">도착 시간</label>
            <TemporalInput type="time" id="callArrivalTime" clearable value={draft.arrivalTime} centered onChange={(e) => setDraft({ ...draft, arrivalTime: e.target.value })} />
          </div>
        </div>
      )}
      {settings.distanceOn && <CallOdometerFields draft={draft} setDraft={setDraft} />}
      {settings.platformOn && (
        <div className="call-detail-panel">
          <div className="call-inline-field platform-main-row">
            <label htmlFor="callPlatform">플랫폼</label>
            <ClearableInput id="callPlatform" className="input-box" placeholder="직접 입력 또는 선택" value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value })} />
          </div>
          <PlatformChips presets={normalizePlatformPresets(settings.platformPresets)} selected={draft.platform} onSelect={(name) => setDraft({ ...draft, platform: name })} onRemove={onRemovePlatform} />
        </div>
      )}
      {settings.paymentOn && !isEmployedDriver && <CallInsuranceFeeField draft={draft} setDraft={setDraft} />}
      <div className="call-detail-panel form-group call-remarks-panel">
        <label htmlFor="callRemarks">메모</label>
        <ClearableInput id="callRemarks" className="input-box" placeholder="특이 사항을 입력해 주세요" value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} />
      </div>
      <div className="modal-btns call-detail-form-actions">
        <button type="button" className="modal-btn cancel" onClick={onClose}>취소</button>
        <button type="button" className="modal-btn confirm" onClick={handleSave}>저장</button>
      </div>
    </div>
  )
}