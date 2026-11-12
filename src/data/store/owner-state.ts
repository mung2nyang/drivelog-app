import { readLogWorkData } from './persist.ts'
import { readPersistDomain } from './persistDomainRead.ts'
import { commitBatch, getState } from './app-store.ts'
import { CLOUD_MEMORY_ONLY_DOMAINS } from './batchWrites.ts'
import { getCloudOwnerKey } from '../cloud/cloudSession.ts'
import { dedupeCarsById } from '../../domain/cars.ts'
import type { PersistDomain } from './persist.ts'
import type { BatchEntry, DriverExpensesReplace, DriverHistoryReplace } from './app-store.ts'
import type { KeyedWrite } from './atomicPersist.ts'
import type { DayRecordLike } from '../../domain/dayRecordTypes.ts'
import type { CarLike, DriverLinkLike, FinanceSettings } from '../../domain/financeTypes.ts'
import type { ClientLike } from '../../domain/clientTypes.ts'
import type { DriverExpenseItem, ExpenseItem } from '../../domain/expenseTypes.ts'
import type { InvoiceLike } from '../../domain/financeTaxInvoiceEntries.ts'
import type { DriverRecord } from '../../domain/driverTypes.ts'
import type { LocalProfile as ProfileLike } from '../hydrate/hydrateMergeTypes.ts'
import type { WorkDataTombstones } from '../../domain/workDataTombstones.ts'

const SLICE_DOMAINS: Array<PersistDomain> = ['cars', 'clients', 'settings', 'expenses', 'invoices', 'drivers', 'profile', 'dismissedNotifications', 'workDataDeletedDates']

export function initializeOwnerFromPersist(ownerKey: string): boolean {
  const cloud = getCloudOwnerKey() === ownerKey
  const entries: Array<BatchEntry> = []
  for (const domain of SLICE_DOMAINS) {
    if (cloud && CLOUD_MEMORY_ONLY_DOMAINS.has(domain)) continue
    const read = readPersistDomain(domain, ownerKey)
    if (!read.ok) return false
    if (cloud && domain === 'settings') {
      const raw = read.value && typeof read.value === 'object' ? read.value : {}
      const theme = 'theme' in raw && raw.theme === 'dark' ? 'dark' : 'light'
      const follow = 'themeFollowPhone' in raw && typeof raw.themeFollowPhone === 'boolean' ? { themeFollowPhone: raw.themeFollowPhone } : {}
      const existing = getState().settings[ownerKey]
      const base = existing && typeof existing === 'object' ? existing : {}
      entries.push({ domain, ownerKey, value: { ...base, theme, ...follow } })
      continue
    }
    const value = domain === 'cars' && Array.isArray(read.value)
      ? dedupeCarsById((read.value) as Array<CarLike>)
      : read.value
    entries.push({ domain, ownerKey, value })
  }
  if (cloud) {
    if (entries.length) commitBatch(entries, { persist: false })
    return true
  }
  const workRead = readLogWorkData(ownerKey, 'main')
  if (!workRead.ok) return false
  entries.push({ domain: 'workData', ownerKey, value: workRead.value })
  const carsEntry = entries.find((entry) => entry.domain === 'cars')
  const cars = Array.isArray(carsEntry?.value) ? (carsEntry.value) as Array<CarLike> : []
  const extra: Record<string, Record<string, DayRecordLike>> = {}
  for (const car of cars) {
    if (car?.type !== 'sub' || !car.number || car.number === 'main') continue
    const logRead = readLogWorkData(ownerKey, car.number)
    if (!logRead.ok) return false
    extra[car.number] = logRead.value
  }
  commitBatch(entries, {
    persist: false,
    replaceWorkLogs: { ownerKey, next: { main: workRead.value, ...extra } },
  })
  return true
}

export type OwnerSnapshot = {
  workData?: Record<string, DayRecordLike>
  workLogs?: Record<string, Record<string, DayRecordLike>>
  cars?: Array<CarLike>
  clients?: Array<ClientLike>
  drivers?: Array<DriverRecord>
  profile?: ProfileLike
  settings?: FinanceSettings
  expenses?: Array<ExpenseItem>
  driverExpenses?: Array<DriverExpenseItem>
  driverHistory?: Array<DriverLinkLike>
  invoices?: Array<InvoiceLike>
  dismissedNotifications?: Array<string>
  workDataDeletedDates?: WorkDataTombstones
}

export function replaceOwnerState(ownerKey: string, snapshot: OwnerSnapshot = {}, options: { persist?: boolean, extraWrites?: Array<KeyedWrite> } = {}) {
  const { persist = true, extraWrites = [] } = options
  const entries: Array<BatchEntry> = []
  const workLogs = snapshot.workLogs && typeof snapshot.workLogs === 'object' ? snapshot.workLogs : null
  if (workLogs) {
    const mainData = workLogs.main && typeof workLogs.main === 'object' ? workLogs.main : {}
    entries.push({ domain: 'workData', ownerKey, value: mainData })
  } else if (snapshot.workData && typeof snapshot.workData === 'object') {
    entries.push({ domain: 'workData', ownerKey, value: snapshot.workData })
  }
  if (Array.isArray(snapshot.cars)) entries.push({ domain: 'cars', ownerKey, value: dedupeCarsById(snapshot.cars) })
  if (Array.isArray(snapshot.clients)) entries.push({ domain: 'clients', ownerKey, value: snapshot.clients })
  if (Array.isArray(snapshot.drivers)) entries.push({ domain: 'drivers', ownerKey, value: snapshot.drivers })
  if (snapshot.profile && typeof snapshot.profile === 'object') entries.push({ domain: 'profile', ownerKey, value: snapshot.profile })
  if (snapshot.settings && typeof snapshot.settings === 'object') entries.push({ domain: 'settings', ownerKey, value: snapshot.settings })
  if (Array.isArray(snapshot.expenses)) entries.push({ domain: 'expenses', ownerKey, value: snapshot.expenses })
  if (Array.isArray(snapshot.invoices)) entries.push({ domain: 'invoices', ownerKey, value: snapshot.invoices })
  if (Array.isArray(snapshot.dismissedNotifications)) entries.push({ domain: 'dismissedNotifications', ownerKey, value: snapshot.dismissedNotifications })
  if (snapshot.workDataDeletedDates && typeof snapshot.workDataDeletedDates === 'object') entries.push({ domain: 'workDataDeletedDates', ownerKey, value: snapshot.workDataDeletedDates })
  const replaceDriverExpenses: DriverExpensesReplace | undefined = Array.isArray(snapshot.driverExpenses)
    ? { ownerKey, next: snapshot.driverExpenses }
    : undefined
  const replaceDriverHistory: DriverHistoryReplace | undefined = Array.isArray(snapshot.driverHistory) ? { ownerKey, next: snapshot.driverHistory } : undefined
  if (!entries.length && !replaceDriverExpenses && !replaceDriverHistory) return
  if (workLogs) {
    commitBatch(entries, { persist, extraWrites, replaceWorkLogs: { ownerKey, next: workLogs }, replaceDriverExpenses, replaceDriverHistory })
    return
  }
  commitBatch(entries, { persist, extraWrites, replaceDriverExpenses, replaceDriverHistory })
}
