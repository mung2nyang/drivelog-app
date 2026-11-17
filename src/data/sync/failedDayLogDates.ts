import { isValidCalendarDateKey } from '../../domain/dateKey.ts'
import { isValidPatch } from './durablePatchSchema.ts'
import type { JsonValue } from '../../domain/jsonTypes.ts'
import type { EffectivePatch } from './pendingWorkDataWritesTypes.ts'

export type FailedDayLogDate = { logId: string, dateKey: string }
type StoredEntry = FailedDayLogDate & { patch?: EffectivePatch, base?: string | null }
type Stored = Record<string, Array<StoredEntry>>

const STORAGE_KEY = 'drivelogFailedDayLogDates'
const listeners = new Set<() => void>()
let version = 0

function toEntry(value: JsonValue): StoredEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const { logId, dateKey, patch, base } = value
  if (typeof logId !== 'string' || logId === '' || typeof dateKey !== 'string' || !isValidCalendarDateKey(dateKey)) return null
  if (patch === undefined || !isValidPatch(patch)) return { logId, dateKey }
  return typeof base === 'string' || base === null ? { logId, dateKey, patch, base } : { logId, dateKey, patch }
}

function readAll(): Stored | null {
  try {
    const parsed = (JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')) as JsonValue
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const result: Stored = {}
    for (const [ownerKey, list] of Object.entries(parsed)) {
      if (Array.isArray(list)) result[ownerKey] = list.map(toEntry).filter((item) => item !== null)
    }
    return result
  } catch {
    return null
  }
}

function isSame(item: FailedDayLogDate, logId: string, dateKey: string) {
  return item.logId === logId && item.dateKey === dateKey
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
  return (readAll()?.[ownerKey] || []).map(({ logId, dateKey }) => ({ logId, dateKey }))
}

export function getFailedDayLogPatch(ownerKey: string, logId: string, dateKey: string): EffectivePatch | undefined {
  return readAll()?.[ownerKey]?.find((item) => isSame(item, logId, dateKey))?.patch
}

export function getFailedDayLogBase(ownerKey: string, logId: string, dateKey: string): string | null | undefined {
  return readAll()?.[ownerKey]?.find((item) => isSame(item, logId, dateKey))?.base
}

export function addFailedDayLogDate(ownerKey: string, logId: string, dateKey: string, patch?: EffectivePatch, base?: string | null) {
  const all = readAll()
  if (!all) return
  const list = all[ownerKey] || []
  const entry: StoredEntry = !patch ? { logId, dateKey } : base === undefined ? { logId, dateKey, patch } : { logId, dateKey, patch, base }
  const index = list.findIndex((item) => isSame(item, logId, dateKey))
  if (index >= 0 && !patch) return
  const next = index >= 0 ? list.map((item, i) => (i === index ? entry : item)) : [...list, entry]
  writeAll({ ...all, [ownerKey]: next })
}

export function removeFailedDayLogDate(ownerKey: string, logId: string, dateKey: string) {
  const all = readAll()
  if (!all) return
  const list = all[ownerKey] || []
  const next = list.filter((item) => !isSame(item, logId, dateKey))
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
