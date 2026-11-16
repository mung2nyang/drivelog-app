import { readOwnerWorkDataByLogId } from '../../../data/store/ownerDataHooks.ts'
import { parsePersistedWorkDataMap } from '../../../data/store/persistDayRecord.ts'
import { isPlainObject } from '../../../data/store/persistDomainRecords.ts'
import { commitMainDayLogMapToCloud } from '../../../data/sync/dayLogCloudCommit.ts'
import { memberBackupBlockedReason } from './memberBackup.ts'
import { isOwnUnlinkedCar, pickMemberRecords, restoreClients, restoreExpenses, restoreInvoices } from './memberRestoreRecords.ts'
import { pickInspections, restoreInspections } from './memberRestoreInspections.ts'
import type { DayRecordLike } from '../../../domain/dayRecordTypes.ts'
import type { JsonValue } from '../../../domain/jsonTypes.ts'
import type { InspectionPick } from './memberRestoreInspections.ts'
import type { RecordPicks } from './memberRestoreRecords.ts'

export type RestoreTarget = { logId: string, records: Record<string, DayRecordLike> }
export type RestoreCounts = { days: number, clients: number, expenses: number, invoices: number, inspections: number }
export type RestorePlan = { ok: true, targets: RestoreTarget[], records: RecordPicks, inspections: InspectionPick[], counts: RestoreCounts, skipped: number }

const INVALID_FILE = '파일 내용이 올바르지 않습니다.'
const EXPENSE_KEYS = ['fuelItems', 'maintItems', 'miscItems']
const KNOWN_KEYS = ['workLogs', 'workData', 'clients', 'expenses', 'invoices', 'dailyInspections']

function readFileLogs(parsed: JsonValue): Record<string, Record<string, DayRecordLike>>|null {
  if (!isPlainObject(parsed)) return null
  let logs: JsonValue = null
  if ('workLogs' in parsed) logs = parsed.workLogs
  else if ('workData' in parsed) logs = { main: parsed.workData }
  else return {}
  if (!isPlainObject(logs)) return null
  const out: Record<string, Record<string, DayRecordLike>> = {}
  for (const [logId, map] of Object.entries(logs)) {
    const days = parsePersistedWorkDataMap(map)
    if (!days) return null
    out[logId] = days
  }
  return out
}

function withoutExpenseItems(record: DayRecordLike): DayRecordLike|null {
  const copy: Record<string, JsonValue|undefined> = { ...record }
  for (const key of EXPENSE_KEYS) delete copy[key]
  return Object.keys(copy).length > 0 ? copy as DayRecordLike : null
}

function employedDriverPicks(parsed: JsonValue, fileLogs: Record<string, Record<string, DayRecordLike>>): { logs: Record<string, Record<string, DayRecordLike>>, records: RecordPicks } {
  const otherLogs = Object.keys(fileLogs).filter((logId) => logId !== 'main' && Object.keys(fileLogs[logId]).length > 0).length
  const otherLists = ['clients', 'expenses', 'invoices'].filter((key) => (
    isPlainObject(parsed) && Array.isArray(parsed[key]) && parsed[key].length > 0
  )).length
  return {
    logs: fileLogs.main ? { main: fileLogs.main } : {},
    records: { clients: [], expenses: [], invoices: [], skippedItems: otherLogs + otherLists },
  }
}

export function planMemberRestore(ownerKey: string, parsed: JsonValue, options: { employed?: boolean } = {}): RestorePlan | { ok: false, error: string } {
  const fileLogs = readFileLogs(parsed)
  const employed = !!options.employed
  const picks = fileLogs && employed ? employedDriverPicks(parsed, fileLogs) : null
  const records = picks ? picks.records : pickMemberRecords(ownerKey, parsed)
  const known = isPlainObject(parsed) && KNOWN_KEYS.some((key) => key in parsed)
  if (!known || !fileLogs || !records) return { ok: false, error: INVALID_FILE }
  const current = readOwnerWorkDataByLogId(ownerKey)
  const targets: RestoreTarget[] = []
  let dayCount = 0
  let skippedCars = 0
  for (const [logId, days] of Object.entries(picks ? picks.logs : fileLogs)) {
    if (Object.keys(days).length === 0) continue
    if (!employed && !isOwnUnlinkedCar(ownerKey, logId)) {
      skippedCars += 1
      continue
    }
    const existing = current[logId] || {}
    const picked: Record<string, DayRecordLike> = {}
    for (const [dateKey, record] of Object.entries(days)) {
      if (existing[dateKey]) continue
      const kept = withoutExpenseItems(record)
      if (kept) picked[dateKey] = kept
    }
    const count = Object.keys(picked).length
    if (count === 0) continue
    targets.push({ logId, records: picked })
    dayCount += count
  }
  const counts = { days: dayCount, clients: records.clients.length, expenses: records.expenses.length, invoices: records.invoices.length, inspections: 0 }
  return { ok: true, targets, records, inspections: [], counts, skipped: skippedCars + records.skippedItems }
}

export async function addInspectionPicks(ownerKey: string, parsed: JsonValue, plan: RestorePlan, options: { employed?: boolean } = {}): Promise<RestorePlan | { ok: false, error: string }> {
  if (options.employed) return plan
  const res = await pickInspections(ownerKey, parsed)
  if (!res.ok) return res
  return { ...plan, inspections: res.picks, counts: { ...plan.counts, inspections: res.picks.length }, skipped: plan.skipped + res.skipped }
}

async function restoreDays(ownerKey: string, targets: RestoreTarget[]): Promise<{ ok: boolean, count: number, toast: string|null }> {
  let count = 0
  for (const { logId, records } of targets) {
    const previousData = readOwnerWorkDataByLogId(ownerKey)[logId] || {}
    const dateKeys = Object.keys(records).filter((dateKey) => !previousData[dateKey]).sort()
    if (dateKeys.length === 0) continue
    const nextData: Record<string, DayRecordLike> = { ...previousData }
    for (const dateKey of dateKeys) nextData[dateKey] = records[dateKey]
    const res = await commitMainDayLogMapToCloud({ ownerKey, logId, dateKeys, previousData, nextData })
    if (!res.cloud) return { ok: false, count, toast: '저장할 차량을 찾지 못했습니다. 잠시 후 다시 시도해 주세요.' }
    count += res.appliedDateKeys.length
    if (!res.ok) return { ok: false, count, toast: res.toast }
  }
  return { ok: true, count, toast: null }
}

export async function applyMemberRestore(ownerKey: string, plan: RestorePlan): Promise<{ ok: boolean, counts: RestoreCounts, toast: string|null }> {
  const counts: RestoreCounts = { days: 0, clients: 0, expenses: 0, invoices: 0, inspections: 0 }
  const blocked = memberBackupBlockedReason(ownerKey)
  if (blocked) return { ok: false, counts, toast: blocked }
  const steps: Array<[keyof RestoreCounts, () => Promise<{ ok: boolean, count: number, toast: string|null }>]> = [
    ['clients', () => restoreClients(ownerKey, plan.records.clients)],
    ['days', () => restoreDays(ownerKey, plan.targets)],
    ['expenses', () => restoreExpenses(ownerKey, plan.records.expenses)],
    ['invoices', () => restoreInvoices(ownerKey, plan.records.invoices)],
    ['inspections', () => restoreInspections(plan.inspections)],
  ]
  for (const [key, run] of steps) {
    const res = await run()
    counts[key] = res.count
    if (!res.ok) return { ok: false, counts, toast: res.toast }
  }
  return { ok: true, counts, toast: null }
}
