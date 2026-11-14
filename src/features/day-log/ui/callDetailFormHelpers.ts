import { dueDateForClient } from '../../../domain/clients.ts'
import { getCallDetailDurationMinutes } from '../../../domain/finance.ts'
import { formatCurrencyInput, formatWon, isLargeFare, parseCurrencyValue } from '../../../domain/money.ts'
import { confirmDialog } from '../../../shared/ui/confirmDialog.tsx'
import type { CallDetailLike, ClientLike } from './dayLogTypes.ts'

export const emptyDraft = {
  client: '',
  fare: '',
  vatExempt: false,
  loadLoc: '',
  unloadLoc: '',
  paymentDueDate: '',
  departureTime: '',
  arrivalTime: '',
  platform: '',
  cargoTonnage: '',
  receipt: '',
  insuranceFee: '',
  remarks: '',
  startOdometer: '',
  endOdometer: '',
}

export function draftFromDetail(item: CallDetailLike, dateKey: string, clients: Array<ClientLike>) {
  const client = clients.find((entry) => entry.companyName === item.client)
  return {
    client: item.client || '',
    fare: formatCurrencyInput(item.fare),
    vatExempt: !!item.vatExempt,
    loadLoc: item.loadLoc || '',
    unloadLoc: item.unloadLoc || '',
    paymentDueDate: item.paymentDueDate || dueDateForClient(dateKey, client),
    departureTime: item.departureTime || '',
    arrivalTime: item.arrivalTime || '',
    platform: item.platform || '',
    cargoTonnage: item.cargoTonnage == null || item.cargoTonnage === '' ? '' : String(item.cargoTonnage),
    receipt: item.receipt || '',
    insuranceFee: formatCurrencyInput(item.insuranceFee),
    remarks: item.remarks || '',
    startOdometer: formatCurrencyInput(item.startOdometer),
    endOdometer: formatCurrencyInput(item.endOdometer),
  }
}

export function commissionInfo(item: CallDetailLike) {
  const snap = item.commissionSnapshot
  if (!snap?.enabled) return { amount: 0, label: '' }
  const fare = parseCurrencyValue(item.fare)
  const amount = snap.type === 'percent' || !snap.type
    ? Math.floor(fare * (Number(snap.value) / 100))
    : parseCurrencyValue(snap.value)
  const label = snap.type === 'percent' || !snap.type ? `${snap.value}%` : formatWon(amount)
  return { amount, label }
}

export function formatCallTime(value: string|undefined) {
  if (!value) return '-'
  const [hourText, minute = '00'] = String(value).split(':')
  const hour = Number(hourText)
  if (Number.isNaN(hour)) return value
  return `${hour < 12 ? 'AM' : 'PM'}${hour % 12 || 12}시${minute === '00' ? '' : `${minute}분`}`
}

export function durationSuffix(detail: { departureTime?: string, arrivalTime?: string }) {
  const minutes = getCallDetailDurationMinutes(detail)
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return ` (${hours ? `${hours}시간` : ''}${mins ? `${mins}분` : ''})`
}

export async function confirmLargeFareSave(fare: string|number|undefined): Promise<boolean> {
  if (!isLargeFare(fare)) return true
  return confirmDialog({
    title: '운송료가 1,000만원을 넘습니다',
    message: `입력한 운송료는 ${fare}원입니다. 이 금액이 맞으면 저장해 주세요.`,
    confirmLabel: '이 금액으로 저장',
    cancelLabel: '금액 고치기',
  })
}
