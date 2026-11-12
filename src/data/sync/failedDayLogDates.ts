import { isValidCalendarDateKey } from '../../domain/dateKey.ts'
import type { JsonValue } from '../../domain/jsonTypes.ts'

export type FailedDayLogDate = { logId: string, dateKey: string }
type Stored = Record<string, Array<FailedDayLogDate>>

const STORAGE_KEY = 'drivelogFailedDayLogDates'
const listeners = new Set<() => void>()
let version = 0

function toEntry(value: JsonValue): FailedDayLogDate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const { logId, dateKey } = value
  if (typeof logId !== 'string' || logId === '' || typeof dateKey !== 'string' || !isValidCalendarDateKey(dateKey)) return null
  return { logId, dateKey }
}

function readAll(): Stored {
  try {
    const parsed = (JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')) as JsonValue
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Stored = {}
    for (const [ownerKey, list] of Object.entries(parsed)) {
      if (Array.isArray(list)) result[ownerKey] = list.map(toEntry).filter((item) => item !== null)
    }
    return result
  } catch {
    return {}
  }
}

function writeAll(next: Stored) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
  }
  version += 1
  listeners.forEach((listener) => listener())
}

export function listFailedDayLogDates(ownerKey: string): Array<FailedDayLogDate> {
  return readAll()[ownerKey] || []
}

export function addFailedDayLogDate(ownerKey: string, logId: string, dateKey: string) {
  const all = readAll()
  const list = all[ownerKey] || []
  if (list.some((item) => item.logId === logId && item.dateKey === dateKey)) return
  writeAll({ ...all, [ownerKey]: [...list, { logId, dateKey }] })
}

export function removeFailedDayLogDate(ownerKey: string, logId: string, dateKey: string) {
  const all = readAll()
  const list = all[ownerKey] || []
  const next = list.filter((item) => !(item.logId === logId && item.dateKey === dateKey))
  if (next.length === list.length) return
  writeAll({ ...all, [ownerKey]: next })
}

export function failedDayLogDatesVersion() {
  return version
}

export function subscribeFailedDayLogDates(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
