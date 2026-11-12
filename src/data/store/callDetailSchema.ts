import * as v from 'valibot'
import { parseCurrencyValue } from '../../domain/money.ts'
import { bool, by, isPlainObject, nonEmptyString, opt, plain, str } from '../../domain/schemaParts.ts'
import type { JsonValue } from '../../domain/jsonTypes.ts'
import type { EffectiveCallDetail } from '../sync/pendingWorkDataWritesTypes.ts'

export function isValidCurrencyAmount(value: JsonValue): boolean {
  if (typeof value === 'number') return Number.isInteger(value) && Number.isFinite(value) && value >= 0
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed === '') return true
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\s?원)?$/.test(trimmed)) return false
  const parsed = parseCurrencyValue(trimmed)
  return Number.isFinite(parsed) && parsed >= 0
}

const amount = by(isValidCurrencyAmount)

const COMMISSION_SNAPSHOT = plain(v.strictObject({
  enabled: bool,
  type: v.nullable(str),
  value: v.nullable(v.union([str, v.custom((input) => typeof input === 'number')])),
}))

const PAYMENT = plain(v.strictObject({
  id: opt(str), amount: opt(amount), paidAt: opt(str), note: opt(str),
}))

const CALL_DETAIL_FIELDS = {
  id: opt(nonEmptyString), loadLoc: opt(str), unloadLoc: opt(str), fare: opt(amount), client: opt(str),
  clientId: opt(v.nullable(str)), commissionSnapshot: opt(COMMISSION_SNAPSHOT),
  remarks: opt(str), vatExempt: opt(bool), paymentStatus: opt(str), payments: opt(v.array(PAYMENT)),
  paymentDueDate: opt(str), workDate: opt(str),
  distanceType: opt(str), linkedLoadIndex: opt(str), departureTime: opt(str), arrivalTime: opt(str), platform: opt(str),
  cargoTonnage: opt(v.union([str, v.pipe(v.number(), v.finite(), v.minValue(0))])),
  receipt: opt(str), startOdometer: opt(str), endOdometer: opt(str), distanceKm: opt(str), insuranceFee: opt(amount),
}

export const ALLOWED_CALL_DETAIL_KEYS = Object.keys(CALL_DETAIL_FIELDS)

const CALL_DETAIL = plain(v.strictObject(CALL_DETAIL_FIELDS), (value) => Object.keys(value).length > 0)

export function isPersistedCallDetail(item: JsonValue) {
  return v.is(CALL_DETAIL, item)
}

export function isValidCallDetail(item: JsonValue): item is EffectiveCallDetail {
  return isPersistedCallDetail(item) && isPlainObject(item) && typeof item.id === 'string' && item.id !== ''
}
