import { callFareTotal, dayTripCount, getCallDetails, getFixedCount, getPalletCount, isOffDay } from './day-record.ts'
import { filterByDate } from './expenses.ts'
import { getDetailPaymentSummary } from './finance.ts'
import { parseCurrencyValue } from './money.ts'
import type { ExpenseItem } from './expenseTypes.ts'
import type { CallDetailLike } from './callDetail.ts'
import type { DayRecordLike } from './dayRecordTypes.ts'

export type { DayRecordLike }

export function formatFareShort(amount: number): string {
  const n = Math.max(0, Number(amount) || 0)
  if (n >= 10000) {
    const thousands = Math.floor(n / 1000)
    const man = Math.floor(thousands / 10)
    const rest = n >= 1000000 ? 0 : thousands % 10
    return rest ? `${man}.${rest}만` : `${man}만`
  }
  return `${n.toLocaleString('ko-KR')}원`
}

export function dayFareTotal(record: DayRecordLike | null | undefined, unitPrice: number | string, palletPrice: number = 0): number {
  const unit = Math.max(0, parseCurrencyValue(unitPrice))
  return getFixedCount(record) * unit + getPalletCount(record) * Math.max(0, palletPrice) + callFareTotal(record)
}

export function dayWorkBadgeLabel(record: DayRecordLike | null | undefined, { inputMode = 'count', unitPrice = 0, palletPrice = 0 }: { inputMode?: 'count' | 'fare', unitPrice?: number | string, palletPrice?: number } = {}): string | null {
  if (isOffDay(record)) return null
  const trips = dayTripCount(record)
  const fare = dayFareTotal(record, unitPrice, inputMode === 'fare' ? palletPrice : 0)
  if (trips <= 0 && fare <= 0) return null
  return inputMode === 'fare' ? formatFareShort(fare) : `${trips}회`
}

export function dayHasUnpaid(record: DayRecordLike | null | undefined, paymentOn: boolean): boolean {
  if (!paymentOn || isOffDay(record)) return false
  return getCallDetails(record).some(
    (detail: CallDetailLike) => getDetailPaymentSummary(detail).status !== 'paid',
  )
}

export function dayExpenseBadgeLabel(expenses: Array<ExpenseItem> | null | undefined, dateKey: string, vehicleNumber?: string): string | null {
  const target = String(vehicleNumber || '').trim() || undefined
  const total = filterByDate(expenses || [], dateKey)
    .filter((item) => (String(item.vehicleNumber || '').trim() || undefined) === target)
    .reduce((sum, item) => sum + (Number(item.cost) || 0), 0)
  return total > 0 ? formatFareShort(total) : null
}

export function expensesForVehicleDay(expenses: Array<ExpenseItem> | null | undefined, dateKey: string, vehicleNumber?: string): Array<ExpenseItem> {
  const target = String(vehicleNumber || '').trim() || undefined
  return filterByDate(expenses || [], dateKey).filter(
    (item) => (String(item.vehicleNumber || '').trim() || undefined) === target,
  )
}
