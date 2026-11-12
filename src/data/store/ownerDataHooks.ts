import { useMemo, useSyncExternalStore } from 'react'
import { getState, subscribe } from './app-store.ts'
import { normalizeSettings } from '../../domain/practiceSettings.ts'
import type { ExpenseItem } from '../../domain/expenseTypes.ts'
import type { ClientLike } from '../../domain/clientTypes.ts'
import type { InvoiceLike } from '../../domain/financeTaxInvoiceEntries.ts'
import type { CarLike } from '../../domain/financeTypes.ts'

const EMPTY_EXPENSES = ([]) as Array<ExpenseItem>

export function readOwnerExpenses(ownerKey: string): Array<ExpenseItem> {
  return getState().expenses[ownerKey] || EMPTY_EXPENSES
}

export function useOwnerExpenses(ownerKey: string): Array<ExpenseItem> {
  return useSyncExternalStore(subscribe, () => readOwnerExpenses(ownerKey))
}

const EMPTY_CLIENTS = ([]) as Array<ClientLike>

export function readOwnerClients(ownerKey: string): Array<ClientLike> {
  return getState().clients[ownerKey] || EMPTY_CLIENTS
}

export function useOwnerClients(ownerKey: string): Array<ClientLike> {
  return useSyncExternalStore(subscribe, () => readOwnerClients(ownerKey))
}

const EMPTY_INVOICES = ([]) as Array<InvoiceLike>

export function readOwnerInvoices(ownerKey: string) {
  return getState().invoices[ownerKey] || EMPTY_INVOICES
}

export function useOwnerInvoices(ownerKey: string) {
  return useSyncExternalStore(subscribe, () => readOwnerInvoices(ownerKey))
}

const EMPTY_CARS = ([]) as Array<CarLike>

export function readOwnerCars(ownerKey: string) {
  return getState().cars[ownerKey] || EMPTY_CARS
}

export function useOwnerCars(ownerKey: string) {
  return useSyncExternalStore(subscribe, () => readOwnerCars(ownerKey))
}

export function readOwnerSettings(ownerKey: string) {
  return normalizeSettings(getState().settings[ownerKey])
}

export function useOwnerSettings(ownerKey: string) {
  const raw = useSyncExternalStore(subscribe, () => getState().settings[ownerKey])
  return useMemo(() => normalizeSettings(raw), [raw])
}

export {
  readOwnerDrivers,
  readOwnerProfile,
  useOwnerDrivers,
  useOwnerProfile,
} from './ownerProfileDriversHooks.ts'

export {
  readOwnerDriverExpenses,
  useOwnerDriverExpenses,
} from './ownerDriverExpensesHooks.ts'

export {
  readOwnerDriverHistory,
  useOwnerDriverHistory,
} from './ownerDriverHistoryHooks.ts'

export {
  readOwnerWorkData,
  readOwnerLogWorkData,
  useOwnerWorkData,
  readOwnerWorkDataByLogId,
  useOwnerWorkDataByLogId,
  readOwnerWorkDataTombstones,
} from './ownerWorkDataHooks.ts'
