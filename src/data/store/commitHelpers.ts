import { commitBatch } from './app-store.ts'
import { storageKeyForLog } from './persist.ts'
import { dedupeCarsById } from '../../domain/cars.ts'
import { getCloudOwnerKey } from '../cloud/cloudSession.ts'
import type { DayRecordLike } from '../../domain/dayRecordTypes.ts'
import type { CarLike, FinanceSettings } from '../../domain/financeTypes.ts'
import type { ClientLike } from '../../domain/clientTypes.ts'
import type { ExpenseItem } from '../../domain/expenseTypes.ts'
import type { InvoiceLike } from '../../domain/financeTaxInvoiceEntries.ts'
import type { DriverRecord } from '../../domain/driverTypes.ts'
import type { LocalProfile as ProfileLike } from '../hydrate/hydrateMergeTypes.ts'
import type { DomainValue } from './app-store.ts'
import type { PersistDomain } from './persist.ts'
import type { JsonValue } from './atomicPersist.ts'

function commit<T extends DomainValue>(domain: PersistDomain, ownerKey: string, value: T): T {
  const [result] = commitBatch([{ domain, ownerKey, value }])
  return (result) as T
}

export function commitWorkData(ownerKey: string, data: Record<string, DayRecordLike>) {
  return commit('workData', ownerKey, data)
}

export function commitLogWorkData(ownerKey: string, logId: string, data: Record<string, DayRecordLike>) {
  if (!logId || logId === 'main') return commitWorkData(ownerKey, data)
  const jsonValue = (data) as JsonValue
  const cloud = getCloudOwnerKey() === ownerKey
  commitBatch([], {
    persist: !cloud,
    extraWrites: cloud ? [] : [{ key: storageKeyForLog(ownerKey, logId), value: jsonValue }],
    mergeWorkLogs: { ownerKey, extra: { [logId]: data } },
  })
  return data
}

export function commitCars(ownerKey: string, cars: Array<CarLike>) {
  return commit('cars', ownerKey, dedupeCarsById(cars))
}

export function commitClients(ownerKey: string, clients: Array<ClientLike>) {
  return commit('clients', ownerKey, clients)
}

export function commitSettings(ownerKey: string, settings: FinanceSettings) {
  return commit('settings', ownerKey, settings)
}

export function commitExpenses(ownerKey: string, items: Array<ExpenseItem>) {
  return commit('expenses', ownerKey, items)
}

export function commitInvoices(ownerKey: string, items: Array<InvoiceLike>) {
  return commit('invoices', ownerKey, items)
}

export function commitDrivers(ownerKey: string, items: Array<DriverRecord>) {
  return commit('drivers', ownerKey, items)
}

export function commitProfile(ownerKey: string, profile: ProfileLike) {
  return commit('profile', ownerKey, profile)
}

export function commitDismissedNotifications(ownerKey: string, ids: Array<string>): Array<string> {
  return commit('dismissedNotifications', ownerKey, ids)
}
