import { writeAllOrNothing } from './atomicPersist.ts'
import { buildBatchWrites } from './batchWrites.ts'
import type { KeyedWrite } from './atomicPersist.ts'
import type { PersistDomain } from './persist.ts'
import type { DayRecordLike } from '../../domain/dayRecordTypes.ts'
import type { CarLike, DriverLinkLike, FinanceSettings } from '../../domain/financeTypes.ts'
import type { ClientLike } from '../../domain/clientTypes.ts'
import type { DriverExpenseItem, ExpenseItem } from '../../domain/expenseTypes.ts'
import type { InvoiceLike } from '../../domain/financeTaxInvoiceEntries.ts'
import type { DriverRecord } from '../../domain/driverTypes.ts'
import type { LocalProfile as ProfileLike } from '../hydrate/hydrateMergeTypes.ts'
import type { WorkDataTombstones } from '../../domain/workDataTombstones.ts'

export type HydrationStatus = 'idle' | 'hydrating' | 'ready' | 'failed'

export type HydrationState = {
  status: HydrationStatus
  userId: string | null
  ownerKey: string | null
  epoch: number
}

export type AppStoreState = {
  hydration: HydrationState
  workLogs: Record<string, Record<string, Record<string, DayRecordLike>>>
  cars: Record<string, Array<CarLike>>
  clients: Record<string, Array<ClientLike>>
  settings: Record<string, FinanceSettings>
  expenses: Record<string, Array<ExpenseItem>>
  driverExpenses: Record<string, Array<DriverExpenseItem>>
  driverHistory: Record<string, Array<DriverLinkLike>>
  invoices: Record<string, Array<InvoiceLike>>
  drivers: Record<string, Array<DriverRecord>>
  profile: Record<string, ProfileLike>
  dismissedNotifications: Record<string, Array<string>>
  workDataDeletedDates: Record<string, WorkDataTombstones>
}

const state: AppStoreState = {
  hydration: { status: 'idle', userId: null, ownerKey: null, epoch: 0 },
  workLogs: {},
  cars: {},
  clients: {},
  settings: {},
  expenses: {},
  driverExpenses: {},
  driverHistory: {},
  invoices: {},
  drivers: {},
  profile: {},
  dismissedNotifications: {},
  workDataDeletedDates: {},
}

const listeners: Set<(state: AppStoreState) => void> = new Set()

function notify() {
  listeners.forEach((listener) => listener(state))
}

export function subscribe(listener: (state: AppStoreState) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getState(): AppStoreState {
  return state
}

export type DomainValue = Record<string, DayRecordLike> | FinanceSettings | ProfileLike |
  WorkDataTombstones | Array<CarLike> |
  Array<ClientLike> | Array<DriverRecord> | Array<ExpenseItem> | Array<DriverExpenseItem> |
  Array<InvoiceLike> | Array<string>

function applyDomainToState(domain: PersistDomain, ownerKey: string, value: DomainValue) {
  if (domain === 'workData') {
    const workData = (value) as Record<string, DayRecordLike>
    const prev = state.workLogs[ownerKey] || {}
    state.workLogs = { ...state.workLogs, [ownerKey]: { ...prev, main: workData } }
    return
  }
  const slice = (domain) as Exclude<PersistDomain, 'workData'>
  const stateAsRecord = (state) as Record<Exclude<PersistDomain, 'workData'>, Record<string, DomainValue>>
  stateAsRecord[slice] = { ...stateAsRecord[slice], [ownerKey]: value }
}

export type BatchEntry = {
  domain: PersistDomain
  ownerKey: string
  value: DomainValue
}

export type WorkLogsMerge = {
  ownerKey: string
  extra: Record<string, Record<string, DayRecordLike>>
}

export type WorkLogsReplace = {
  ownerKey: string
  next: Record<string, Record<string, DayRecordLike>>
}

export type DriverExpensesReplace = {
  ownerKey: string
  next: Array<DriverExpenseItem>
}

export type DriverHistoryReplace = { ownerKey: string, next: Array<DriverLinkLike> }

export function commitBatch(entries: Array<BatchEntry>, options: { persist?: boolean, extraWrites?: Array<KeyedWrite>, mergeWorkLogs?: WorkLogsMerge, replaceWorkLogs?: WorkLogsReplace, replaceDriverExpenses?: DriverExpensesReplace, replaceDriverHistory?: DriverHistoryReplace } = {}): Array<DomainValue> {
  const { persist = true, extraWrites = [], mergeWorkLogs, replaceWorkLogs, replaceDriverExpenses, replaceDriverHistory } = options
  const cloudOwnerKey = state.hydration.userId ? state.hydration.ownerKey : null
  const writes = [...buildBatchWrites(entries, { persist, cloudOwnerKey })]
  if (persist && extraWrites.length && cloudOwnerKey == null) writes.push(...extraWrites)
  if (writes.length) writeAllOrNothing(writes)

  entries.forEach(({ domain, ownerKey, value }) => {
    applyDomainToState(domain, ownerKey, value)
  })
  if (mergeWorkLogs) {
    const prev = state.workLogs[mergeWorkLogs.ownerKey] || {}
    state.workLogs = { ...state.workLogs, [mergeWorkLogs.ownerKey]: { ...prev, ...mergeWorkLogs.extra } }
  }
  if (replaceWorkLogs) {
    state.workLogs = { ...state.workLogs, [replaceWorkLogs.ownerKey]: replaceWorkLogs.next }
  }
  if (replaceDriverExpenses) {
    state.driverExpenses = { ...state.driverExpenses, [replaceDriverExpenses.ownerKey]: replaceDriverExpenses.next }
  }
  if (replaceDriverHistory) {
    state.driverHistory = { ...state.driverHistory, [replaceDriverHistory.ownerKey]: replaceDriverHistory.next }
  }
  notify()
  return entries.map((entry) => entry.value)
}

export function setHydration(patch: Partial<HydrationState>) {
  state.hydration = { ...state.hydration, ...patch }
  notify()
}
