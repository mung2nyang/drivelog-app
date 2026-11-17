import * as v from 'valibot'
import { isValidCalendarDateKey } from '../../domain/dateKey.ts'
import { isPersistedCallDetail } from './callDetailSchema.ts'
import { bool, by, finiteNumber, isPlainObject, opt, plain, str } from '../../domain/schemaParts.ts'
import { isPersistedFuelList, isPersistedMaintList, isPersistedMiscList } from './persistDayRecordLegacy.ts'
import type { JsonValue } from '../../domain/jsonTypes.ts'
import type { DayRecordLike } from '../../domain/dayRecordTypes.ts'

const count = v.pipe(v.number(), v.integer(), v.minValue(0))
const RETIRED_DAY_KEYS = ['fare', 'fixedFare', 'totalFare', 'count']

const DAY_RECORD_FIELDS = {
  isOff: opt(bool), fixedCount: opt(count), palletCount: opt(count),
  callDetails: opt(v.array(by(isPersistedCallDetail))),
  fixedRouteCounts: opt(plain(v.record(str, count))),
  dailyDistance: opt(v.pipe(finiteNumber, v.minValue(0))),
  fuelItems: opt(by(isPersistedFuelList)), maintItems: opt(by(isPersistedMaintList)), miscItems: opt(by(isPersistedMiscList)),
  assignedVehicleNumber: opt(str),
}

const DAY_RECORD_KEYS = Object.keys(DAY_RECORD_FIELDS)

const DAY_RECORD = plain(v.strictObject(DAY_RECORD_FIELDS), (value) => Object.keys(value).length > 0)

export function canonicalizeDayRecord(value: JsonValue): JsonValue {
  if (value === 'off') return { isOff: true }
  if (!isPlainObject(value)) return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !RETIRED_DAY_KEYS.includes(key)))
}

function onlyRetiredKeys(value: JsonValue) {
  return isPlainObject(value) && Object.keys(value).length > 0 && Object.keys(value).every((key) => RETIRED_DAY_KEYS.includes(key))
}

export function isPersistedDayRecord(value: JsonValue): value is DayRecordLike {
  return v.is(DAY_RECORD, value)
}

export function parsePersistedWorkDataMap(parsed: JsonValue): Record<string, DayRecordLike> | null {
  if (!isPlainObject(parsed)) return null
  const out: Record<string, DayRecordLike> = {}
  for (const [dateKey, record] of Object.entries(parsed)) {
    if (!isValidCalendarDateKey(dateKey)) return null
    if (onlyRetiredKeys(record)) continue
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
