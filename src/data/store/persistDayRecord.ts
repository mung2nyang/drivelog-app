import * as v from 'valibot'
import { isValidCalendarDateKey } from '../../domain/dateKey.ts'
import { isPersistedCallDetail, isValidCurrencyAmount } from './callDetailSchema.ts'
import { bool, by, finiteNumber, isPlainObject, opt, plain, str } from '../../domain/schemaParts.ts'
import { isPersistedFuelList, isPersistedMaintList, isPersistedMiscList } from './persistDayRecordLegacy.ts'
import type { JsonValue } from '../../domain/jsonTypes.ts'
import type { DayRecordLike } from '../../domain/dayRecordTypes.ts'

const count = v.pipe(v.number(), v.integer(), v.minValue(0))
const amount = by(isValidCurrencyAmount)

const DAY_RECORD_FIELDS = {
  isOff: opt(bool), fixedCount: opt(count), palletCount: opt(count),
  callDetails: opt(v.array(by(isPersistedCallDetail))),
  fixedRouteCounts: opt(plain(v.record(str, count))),
  fare: opt(amount), fixedFare: opt(amount), totalFare: opt(amount), count: opt(count),
  dailyDistance: opt(v.pipe(finiteNumber, v.minValue(0))),
  fuelItems: opt(by(isPersistedFuelList)), maintItems: opt(by(isPersistedMaintList)), miscItems: opt(by(isPersistedMiscList)),
  assignedVehicleNumber: opt(str),
}

const DAY_RECORD_KEYS = Object.keys(DAY_RECORD_FIELDS)

const DAY_RECORD = plain(v.strictObject(DAY_RECORD_FIELDS), (value) => Object.keys(value).length > 0)

export function canonicalizeDayRecord(value: JsonValue) {
  return value === 'off' ? { isOff: true } : value
}

export function isPersistedDayRecord(value: JsonValue): value is DayRecordLike {
  return v.is(DAY_RECORD, value)
}

export function parsePersistedWorkDataMap(parsed: JsonValue): Record<string, DayRecordLike> | null {
  if (!isPlainObject(parsed)) return null
  const out: Record<string, DayRecordLike> = {}
  for (const [dateKey, record] of Object.entries(parsed)) {
    if (!isValidCalendarDateKey(dateKey)) return null
    const canonical = canonicalizeDayRecord(record)
    if (!isPersistedDayRecord(canonical)) return null
    out[dateKey] = canonical
  }
  return out
}

export function isPersistedWorkDataMap(parsed: JsonValue): parsed is Record<string, DayRecordLike> {
  return parsePersistedWorkDataMap(parsed) !== null
}

export { DAY_RECORD_KEYS }
