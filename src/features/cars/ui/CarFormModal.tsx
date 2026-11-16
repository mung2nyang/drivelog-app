import { useState } from 'react'
import { checkCarDraft } from '../../../domain/cars.ts'
import { formatPhoneNumber, tonnageDigits, tonnageValue } from '../../../domain/formatPhone.ts'
import { formatCurrencyInput, formatPercentInput } from '../../../domain/money.ts'
import CarDriverConnectPanel from './CarDriverConnectPanel.tsx'
import CarDriverIncomeFields from './CarDriverIncomeFields.tsx'
import CarFuelKindField from '../../../shared/ui/CarFuelKindField.tsx'
import ClearableInput from '../../../shared/ui/ClearableInput.tsx'
import CurrencyInput from '../../../shared/ui/CurrencyInput.tsx'
import FieldError, { focusField, invalidProps } from '../../../shared/ui/FieldError.tsx'
import ModalShell from '../../../shared/ui/ModalShell.tsx'
import CarShareBaseField from './CarShareBaseField.tsx'
import type { DriverRecord } from '../../../domain/driverTypes.ts'
import type { Dispatch, SetStateAction } from 'react'

export type CarFormDraft = {
  number: string
  tonnage: string
  fuelKind?: string
  type: 'main'|'sub'
  driverName: string
  driverPhone: string
  driverPayMode: string
  driverSalaryAmount: string
  commEnabled: boolean
  commType: string
  commission: string
  insuranceOn?: boolean
  driverIncomeType?: 'employee'|'business'
  withholdingOn?: boolean
  expenseRate?: string
  insuranceRate?: string
  insuranceSplit?: 'owner'|'half'|'driver'
  driverShareBase?: 'gross'|'afterClientCommission'
  inviteCode: string
  inviteStartDate: string
  inviteDriverId: string|null
  connectMode: 'link'|'log'
}
export type CarProblem = NonNullable<ReturnType<typeof checkCarDraft>>

const INPUT_IDS = { number: 'newCarNumber', driverName: 'newDriverName', driverPhone: 'newUserPhone', driverSalaryAmount: 'newCarSettlementValue' }

type CarFormModalProps = {
  draft: CarFormDraft
  setDraft: Dispatch<SetStateAction<CarFormDraft>>
  editingId: string|null
  onCancel: () => void
  onSave: () => void|Promise<void>
  saving?: boolean
  cloud?: boolean
  drivers?: Array<DriverRecord>
}

export default function CarFormModal({
  draft, setDraft, editingId, onCancel, onSave, saving = false,
  cloud = false, drivers = [],
}: CarFormModalProps) {
  const isSub = draft.type === 'sub'
  const isSalary = draft.driverPayMode === 'salary'
  const showConnect = isSub && cloud
  const [problem, setProblem] = useState<(CarProblem & { value: string })|null>(null)
  const shown = problem && String(draft[problem.field] ?? '') === problem.value ? problem : null

  function handleSave() {
    const found = checkCarDraft(draft, { linkRequired: showConnect && draft.connectMode === 'link' })
    if (!found) {
      setProblem(null)
      onSave()
      return
    }
    setProblem({ ...found, value: String(draft[found.field] ?? '') })
    focusField(INPUT_IDS[found.field])
  }

  function setRevenueMode() {
    setDraft((prev) => ({
      ...prev,
      driverPayMode: 'revenue',
      commEnabled: true,
      commType: 'percent',
    }))
  }

  function setSalaryMode() {
    setDraft((prev) => ({
      ...prev,
      driverPayMode: 'salary',
      commEnabled: false,
      commission: '',
    }))
  }

  function onCommissionChange(value: string) {
    setDraft((prev) => ({
      ...prev,
      commission: formatPercentInput(value),
    }))
  }

  return (
    <ModalShell onClose={onCancel} closeOnOverlay={false} closeOnEscape={false} contentClassName="modal-content car-modal" label="차량">
      <div className="modal-title">
        {editingId ? (isSub ? '기사 정보 수정' : '차량 수정') : (isSub ? '기사 등록' : '차량 등록')}
      </div>
      <div className="personal-inline-fields">
        <div className="form-group">
          <label htmlFor="newCarNumber">차량번호</label>
          <ClearableInput id="newCarNumber" className="input-box" placeholder="12가 3456" value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} {...invalidProps(shown, 'number', 'newCarNumber')} />
          <FieldError problem={shown} field="number" inputId="newCarNumber" />
        </div>
        <div className="form-group">
          <label htmlFor="newCarTonnage">차량 톤수</label>
          <div className="unit-input">
            <input id="newCarTonnage" className="input-box" inputMode="decimal" placeholder="예: 5, 11, 25" value={tonnageDigits(draft.tonnage)} onChange={(e) => setDraft({ ...draft, tonnage: tonnageValue(e.target.value) })} onBlur={() => setDraft({ ...draft, tonnage: tonnageValue(draft.tonnage, true) })} />
            <span className="unit-input-suffix">톤</span>
          </div>
        </div>
      </div>
      <CarFuelKindField id="newCarFuelKind" value={draft.fuelKind} onChange={(next) => setDraft({ ...draft, fuelKind: next })} />
      {isSub && (
        <>
          <div className="form-group">
            <label htmlFor="newDriverName">기사명</label>
            <ClearableInput id="newDriverName" className="input-box" placeholder="기사명을 입력하세요" value={draft.driverName} onChange={(e) => setDraft({ ...draft, driverName: e.target.value })} {...invalidProps(shown, 'driverName', 'newDriverName')} />
            <FieldError problem={shown} field="driverName" inputId="newDriverName" />
          </div>
          <div className="form-group">
            <label htmlFor="newUserPhone">연락처</label>
            <ClearableInput id="newUserPhone" className="input-box" type="tel" placeholder="010-0000-0000" value={draft.driverPhone} onChange={(e) => setDraft({ ...draft, driverPhone: formatPhoneNumber(e.target.value) })} {...invalidProps(shown, 'driverPhone', 'newUserPhone')} />
            <FieldError problem={shown} field="driverPhone" inputId="newUserPhone" />
          </div>
          <hr className="car-modal-divider" />
          <div className="form-group">
            <label htmlFor="newCarSettlementValue">정산</label>
            <p className="car-settlement-mode-guide">
              {isSalary
                ? '기사에게 월별로 지급할 고정 금액을 설정합니다.'
                : '이 차량의 매출 중 기사에게 지급할 비율을 설정합니다.'}
            </p>
            <div className="car-commission-value">
              <div className="car-commission-type" role="group" aria-label="정산 방식">
                <button type="button" className={!isSalary ? 'active' : ''} aria-pressed={!isSalary} onClick={setRevenueMode}>매출제</button>
                <button type="button" className={isSalary ? 'active' : ''} aria-pressed={isSalary} onClick={setSalaryMode}>월급제</button>
              </div>
              <span className="car-commission-input">
                {isSalary ? (
                  <CurrencyInput
                    id="newCarSettlementValue"
                    placeholder="0"
                    value={formatCurrencyInput(draft.driverSalaryAmount)}
                    onValueChange={(next) => setDraft({ ...draft, driverSalaryAmount: next.replace(/\D/g, '') })}
                    {...invalidProps(shown, 'driverSalaryAmount', 'newCarSettlementValue')}
                  />
                ) : (
                  <input
                    id="newCarSettlementValue"
                    inputMode="decimal"
                    placeholder="0"
                    value={draft.commission}
                    onChange={(e) => onCommissionChange(e.target.value)}
                  />
                )}
                <b>{isSalary ? '원' : '%'}</b>
              </span>
            </div>
            <FieldError problem={shown} field="driverSalaryAmount" inputId="newCarSettlementValue" />
          </div>
          {!isSalary && <CarShareBaseField value={draft.driverShareBase} onChange={(next) => setDraft({ ...draft, driverShareBase: next })} />}
          <hr className="car-modal-divider" />
          <CarDriverIncomeFields draft={draft} setDraft={setDraft} />
        </>
      )}
      {showConnect ? (
        <>
          <hr className="car-modal-divider" />
          <CarDriverConnectPanel
            tab={draft.connectMode || 'link'}
            onTab={(mode) => setDraft({ ...draft, connectMode: mode })}
            inviteCode={draft.inviteCode || ''}
            onInviteCode={(code) => setDraft({ ...draft, inviteCode: code })}
            drivers={drivers}
          />
        </>
      ) : (
        <p className="car-type-hint">{isSub ? '기사 차량으로 등록됩니다.' : '메인 차량으로 등록됩니다.'}</p>
      )}
      <div className="modal-btns">
        <button type="button" className="modal-btn cancel" onClick={onCancel}>취소</button>
        <button type="button" className="modal-btn confirm" disabled={saving} onClick={handleSave}>{saving ? '저장 중…' : '저장'}</button>
      </div>
    </ModalShell>
  )
}
