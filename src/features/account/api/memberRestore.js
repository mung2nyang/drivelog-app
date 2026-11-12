// @ts-check
import { readOwnerWorkDataByLogId } from '../../../data/store/ownerDataHooks.ts'
import { parsePersistedWorkDataMap } from '../../../data/store/persistDayRecord.ts'
import { isPlainObject } from '../../../data/store/persistDomainRecords.ts'
import { commitMainDayLogMapToCloud } from '../../../data/sync/dayLogCloudCommit.ts'
import { memberBackupBlockedReason } from './memberBackup.js'
import { isOwnUnlinkedCar, pickMemberRecords, restoreClients, restoreExpenses, restoreInvoices } from './memberRestoreRecords.js'
import { pickInspections, restoreInspections } from './memberRestoreInspections.js'

/** @typedef {import('../../../domain/dayRecordTypes.ts').DayRecordLike} DayRecordLike */
/** @typedef {import('../../../domain/jsonTypes.ts').JsonValue} JsonValue */
/** @typedef {{ logId: string, records: Record<string, DayRecordLike> }} RestoreTarget */
/** @typedef {{ days: number, clients: number, expenses: number, invoices: number, inspections: number }} RestoreCounts */
/**
  * @typedef {{ ok: true, targets: RestoreTarget[], records: import('./memberRestoreRecords.js').RecordPicks,
 *   inspections: import('./memberRestoreInspections.js').InspectionPick[], counts: RestoreCounts, skipped: number }} RestorePlan 
 */

const INVALID_FILE = '파일 내용이 올바르지 않습니다.'
const EXPENSE_KEYS = ['fuelItems', 'maintItems', 'miscItems']
const KNOWN_KEYS = ['workLogs', 'workData', 'clients', 'expenses', 'invoices', 'dailyInspections']

/**
 * @param {JsonValue} parsed
 * @returns {Record<string, Record<string, DayRecordLike>>|null}
 */
function readFileLogs(parsed) {
  if (!isPlainObject(parsed)) return null
  /** @type {JsonValue} */
  let logs = null
  if ('workLogs' in parsed) logs = parsed.workLogs
  else if ('workData' in parsed) logs = { main: parsed.workData }
  else return {}
  if (!isPlainObject(logs)) return null
  /** @type {Record<string, Record<string, DayRecordLike>>} */
  const out = {}
  for (const [logId, map] of Object.entries(logs)) {
    const days = parsePersistedWorkDataMap(map)
    if (!days) return null
    out[logId] = days
  }
  return out
}

/** @param {DayRecordLike} record @returns {DayRecordLike|null} 지출 칸을 뺀 기록(남는 게 없으면 null) */
function withoutExpenseItems(record) {
  /** @type {Record<string, JsonValue|undefined>} */
  const copy = { ...record }
  for (const key of EXPENSE_KEYS) delete copy[key]
  return Object.keys(copy).length > 0 ? /** @type {DayRecordLike} */ (copy) : null
}

/**
 * @param {JsonValue} parsed @param {Record<string, Record<string, DayRecordLike>>} fileLogs
 * @returns {{ logs: Record<string, Record<string, DayRecordLike>>, records: import('./memberRestoreRecords.js').RecordPicks }}
 */
function employedDriverPicks(parsed, fileLogs) {
  const otherLogs = Object.keys(fileLogs).filter((logId) => logId !== 'main' && Object.keys(fileLogs[logId]).length > 0).length
  const otherLists = ['clients', 'expenses', 'invoices'].filter((key) => (
    isPlainObject(parsed) && Array.isArray(parsed[key]) && parsed[key].length > 0
  )).length
  return {
    logs: fileLogs.main ? { main: fileLogs.main } : {},
    records: { clients: [], expenses: [], invoices: [], skippedItems: otherLogs + otherLists },
  }
}

/**
 * @param {string} ownerKey
 * @param {JsonValue} parsed
 * @param {{ employed?: boolean }} [options]
 * @returns {RestorePlan | { ok: false, error: string }}
 */
export function planMemberRestore(ownerKey, parsed, options = {}) {
  const fileLogs = readFileLogs(parsed)
  const employed = !!options.employed
  const picks = fileLogs && employed ? employedDriverPicks(parsed, fileLogs) : null
  const records = picks ? picks.records : pickMemberRecords(ownerKey, parsed)
  const known = isPlainObject(parsed) && KNOWN_KEYS.some((key) => key in parsed)
  if (!known || !fileLogs || !records) return { ok: false, error: INVALID_FILE }
  const current = readOwnerWorkDataByLogId(ownerKey)
  /** @type {RestoreTarget[]} */
  const targets = []
  let dayCount = 0
  let skippedCars = 0
  for (const [logId, days] of Object.entries(picks ? picks.logs : fileLogs)) {
    if (Object.keys(days).length === 0) continue
    if (!employed && !isOwnUnlinkedCar(ownerKey, logId)) {
      skippedCars += 1
      continue
    }
    const existing = current[logId] || {}
    /** @type {Record<string, DayRecordLike>} */
    const picked = {}
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

/**
 * @param {string} ownerKey @param {JsonValue} parsed @param {RestorePlan} plan @param {{ employed?: boolean }} [options]
 * @returns {Promise<RestorePlan | { ok: false, error: string }>}
 */
export async function addInspectionPicks(ownerKey, parsed, plan, options = {}) {
  if (options.employed) return plan
  const res = await pickInspections(ownerKey, parsed)
  if (!res.ok) return res
  return { ...plan, inspections: res.picks, counts: { ...plan.counts, inspections: res.picks.length }, skipped: plan.skipped + res.skipped }
}

/**
 * @param {string} ownerKey @param {RestoreTarget[]} targets
 * @returns {Promise<{ ok: boolean, count: number, toast: string|null }>}
 */
async function restoreDays(ownerKey, targets) {
  let count = 0
  for (const { logId, records } of targets) {
    const previousData = readOwnerWorkDataByLogId(ownerKey)[logId] || {}
    const dateKeys = Object.keys(records).filter((dateKey) => !previousData[dateKey]).sort()
    if (dateKeys.length === 0) continue
    /** @type {Record<string, DayRecordLike>} */
    const nextData = { ...previousData }
    for (const dateKey of dateKeys) nextData[dateKey] = records[dateKey]
    const res = await commitMainDayLogMapToCloud({ ownerKey, logId, dateKeys, previousData, nextData })
    if (!res.cloud) return { ok: false, count, toast: '저장할 차량을 찾지 못했습니다. 잠시 후 다시 시도해 주세요.' }
    count += res.appliedDateKeys.length
    if (!res.ok) return { ok: false, count, toast: res.toast }
  }
  return { ok: true, count, toast: null }
}

/**
 * @param {string} ownerKey
 * @param {RestorePlan} plan
 * @returns {Promise<{ ok: boolean, counts: RestoreCounts, toast: string|null }>}
 */
export async function applyMemberRestore(ownerKey, plan) {
  /** @type {RestoreCounts} */
  const counts = { days: 0, clients: 0, expenses: 0, invoices: 0, inspections: 0 }
  const blocked = memberBackupBlockedReason(ownerKey)
  if (blocked) return { ok: false, counts, toast: blocked }
  /** @type {Array<[keyof RestoreCounts, () => Promise<{ ok: boolean, count: number, toast: string|null }>]>} */
  const steps = [
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
