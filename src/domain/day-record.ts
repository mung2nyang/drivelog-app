import { dedupeCallDetailsById, withCoercedCallDetailId } from './callDetailIds.ts'
import { getDetailPaymentSummary } from './finance.ts'
import { parseCurrencyValue, vatOf } from './money.ts'
import type { DayRecordLike } from './dayRecordTypes.ts'
import type { CallDetailLike } from './callDetail.ts'

export type { DayRecordLike }

export function getFixedCount(record: DayRecordLike | null | undefined) {
  if (record?.isOff) return 0
  return Math.max(0, parseInt(String(record?.fixedCount), 10) || 0)
}

export function getPalletCount(record: DayRecordLike | null | undefined) {
  if (record?.isOff) return 0
  return Math.max(0, parseInt(String(record?.palletCount), 10) || 0)
}

export function getFixedRouteCounts(record: { fixedRouteCounts?: Record<string, number> } | null | undefined) {
  const counts = record?.fixedRouteCounts
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return {}
  const next: Record<string, number> = {}
  Object.entries(counts).forEach(([routeId, value]) => {
    const n = parseInt(String(value), 10) || 0
    if (n > 0) next[routeId] = n
  })
  return next
}

export function applyFixedRouteRun(counts: Record<string, number> | undefined, routeId: string, delta: number) {
  const next = { ...getFixedRouteCounts({ fixedRouteCounts: counts }) }
  const value = Math.max(0, (next[routeId] || 0) + delta)
  if (value <= 0) delete next[routeId]
  else next[routeId] = value
  return next
}

export function isOffDay(record: DayRecordLike | null | undefined) {
  return !!record?.isOff
}

export function getCallDetails(record: DayRecordLike | null | undefined) {
  return Array.isArray(record?.callDetails) ? record.callDetails : []
}

export function backfillCallDetailIds(record: DayRecordLike | undefined): { record: DayRecordLike | undefined, changed: boolean } {
  const list = Array.isArray(record?.callDetails) ? record.callDetails : []
  if (list.length === 0) return { record, changed: false }
  let changed = false
  const callDetails = list.map((item) => {
    const coerced = withCoercedCallDetailId(item)
    if (coerced !== item) {
      changed = true
      return coerced
    }
    if (item?.id) return item
    changed = true
    return { ...item, id: `trp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }
  })
  if (!changed) return { record, changed: false }
  return { record: { ...record, callDetails }, changed: true }
}

export function callCountsAsTrip(detail: CallDetailLike | null | undefined) {
  const type = detail?.distanceType || ''
  if (type === '공차') return false
  if (type === '혼짐') return detail?.linkedLoadIndex === 'pending' || detail?.linkedLoadIndex === '-1' || detail?.linkedLoadIndex === undefined
  return true
}

export function countCallTrips(record: DayRecordLike | null | undefined) {
  if (!record || record.isOff) return 0
  return getCallDetails(record).filter(callCountsAsTrip).length
}

export function dayTripCount(record: DayRecordLike | null | undefined) {
  return getFixedCount(record) + countCallTrips(record)
}

export function getRecordTotalDistance(record: DayRecordLike | null | undefined) {
  const details = getCallDetails(record)
  const hasDetailDistance = details.some((d) => String(d?.distanceKm ?? '').trim() !== '')
  if (hasDetailDistance) {
    return details.reduce((sum, d) => sum + (parseFloat(String(d?.distanceKm)) || 0), 0)
  }
  return parseFloat(String(record?.dailyDistance ?? '')) || 0
}

export function callFareTotal(record: DayRecordLike | null | undefined) {
  if (!record || record.isOff) return 0
  return getCallDetails(record).reduce((sum, detail) => sum + parseCurrencyValue(detail.fare), 0)
}

export function callVatTotal(record: DayRecordLike | null | undefined) {
  if (!record || record.isOff) return 0
  return getCallDetails(record).reduce((sum, detail) => {
    const fare = parseCurrencyValue(detail.fare)
    return sum + (detail.vatExempt ? 0 : vatOf(fare))
  }, 0)
}

export function monthWorkFareSummary(data: Record<string, DayRecordLike>, year: number, month: number, unitPrice: number | string) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  let trips = 0
  let callTrips = 0
  let callFare = 0
  let callVat = 0
  for (const [key, record] of Object.entries(data || {})) {
    if (!key.startsWith(prefix)) continue
    trips += getFixedCount(record)
    callTrips += countCallTrips(record)
    callFare += callFareTotal(record)
    callVat += callVatTotal(record)
  }
  const unit = Math.max(0, parseCurrencyValue(unitPrice))
  const fixedFare = trips * unit
  const fare = fixedFare + callFare
  const vat = vatOf(fixedFare) + callVat
  return { trips, callTrips, fixedFare, callFare, fare, vat, total: fare + vat }
}

export function saveDayRecord(data: Record<string, DayRecordLike>, dateKey: string, { isOff = false, fixedCount = 0, callDetails, fixedRouteCounts, palletCount }: { isOff?: boolean, fixedCount?: number | string, callDetails?: Array<CallDetailLike>, fixedRouteCounts?: Record<string, number>, palletCount?: number | string } = {}): Record<string, DayRecordLike> {
  const next = { ...data }
  const off = !!isOff
  const count = off ? 0 : Math.max(0, parseInt(String(fixedCount), 10) || 0)
  const prev = next[dateKey] || {}
  const details = dedupeCallDetailsById(Array.isArray(callDetails) ? callDetails : getCallDetails(prev))
  const routeCounts = off ? {} : getFixedRouteCounts({
    fixedRouteCounts: fixedRouteCounts !== undefined ? fixedRouteCounts : prev.fixedRouteCounts,
  })
  const pallets = off ? 0 : Math.max(0, parseInt(String(palletCount !== undefined ? palletCount : prev.palletCount), 10) || 0)

  if (!off && count === 0 && pallets === 0 && details.length === 0 && !prev.assignedVehicleNumber) {
    delete next[dateKey]
  } else {
    const restPrev = { ...prev }
    delete restPrev.fuelItems
    delete restPrev.maintItems
    delete restPrev.miscItems
    next[dateKey] = {
      ...restPrev,
      isOff: off,
      fixedCount: count,
      callDetails: details,
      fixedRouteCounts: routeCounts,
      palletCount: pallets,
    }
  }
  return next
}

export function monthCallUnpaidTotal(data: Record<string, DayRecordLike>, year: number, month: number) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  let total = 0
  for (const [key, record] of Object.entries(data || {})) {
    if (!key.startsWith(prefix) || isOffDay(record)) continue
    getCallDetails(record).forEach((detail) => {
      const summary = getDetailPaymentSummary(detail)
      if (summary.status !== 'paid') total += summary.remainingAmount
    })
  }
  return total
}

export function monthWorkTotal(data: Record<string, DayRecordLike>, year: number, month: number) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  let total = 0
  for (const [key, record] of Object.entries(data)) {
    if (key.startsWith(prefix)) total += getFixedCount(record)
  }
  return total
}
