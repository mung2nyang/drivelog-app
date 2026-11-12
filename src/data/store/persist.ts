import { parsePersistedWorkDataMap } from './persistDayRecord.ts'
import type { DayRecordLike } from '../../domain/dayRecordTypes.ts'

export type PersistDomain = 'workData' | 'cars' | 'clients' | 'settings' | 'expenses' | 'invoices' | 'drivers' | 'profile' | 'dismissedNotifications' | 'workDataDeletedDates'

export const PERSIST_KEYS: Record<PersistDomain, string> = Object.freeze({
  workData: 'reactPracticeWorkData',
  cars: 'reactPracticeCars',
  clients: 'reactPracticeClients',
  settings: 'reactPracticeSettings',
  expenses: 'reactPracticeExpenses',
  invoices: 'reactPracticeInvoices',
  drivers: 'reactPracticeDrivers',
  profile: 'reactPracticeProfile',
  dismissedNotifications: 'reactPracticeDismissedNotifs',
  workDataDeletedDates: 'reactPracticeWorkDataDeletedDates',
})

export function storageKeyFor(domain: PersistDomain, ownerKey: string): string {
  const prefix = PERSIST_KEYS[domain]
  if (!prefix) throw new Error(`[persist] 알 수 없는 도메인입니다: ${domain}`)
  return `${prefix}:${ownerKey}`
}

export function storageKeyForLog(ownerKey: string, logId: string) {
  if (!logId || logId === 'main') return storageKeyFor('workData', ownerKey)
  return `${PERSIST_KEYS.workData}:${ownerKey}:log:${logId}`
}

export type LogWorkDataRead = { ok: true, kind: 'missing', value: Record<string, DayRecordLike> }
  | { ok: true, kind: 'value', value: Record<string, DayRecordLike> }
  | { ok: false, kind: 'getItem' | 'parse' | 'schema' }

export function readLogWorkData(ownerKey: string, logId = 'main'): LogWorkDataRead {
  const key = storageKeyForLog(ownerKey, logId)
  let raw
  try {
    raw = localStorage.getItem(key)
  } catch {
    return { ok: false, kind: 'getItem' }
  }
  if (raw === null) return { ok: true, kind: 'missing', value: {} }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, kind: 'parse' }
  }
  const mapped = parsePersistedWorkDataMap(parsed)
  if (!mapped) return { ok: false, kind: 'schema' }
  return { ok: true, kind: 'value', value: mapped }
}

export function readJsonKey<T>(domain: PersistDomain, ownerKey: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKeyFor(domain, ownerKey))
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeJsonKey<T>(domain: PersistDomain, ownerKey: string, value: T) {
  localStorage.setItem(storageKeyFor(domain, ownerKey), JSON.stringify(value))
}
