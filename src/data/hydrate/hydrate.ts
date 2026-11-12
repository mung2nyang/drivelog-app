import { supabase } from '../cloud/supabaseClient.ts'
import { getState, setHydration } from '../store/app-store.ts'
import { replaceOwnerState } from '../store/owner-state.ts'
import { readOwnerWorkDataTombstones } from '../store/ownerDataHooks.ts'
import { singleFlight } from '../cloud/singleFlight.ts'
import { beginSessionEpoch, getCloudOwnerKey, getCloudUserId, isSessionStillCurrent } from '../cloud/cloudSession.ts'
import { normalizeSettings } from '../../domain/practiceSettings.ts'
import { readPersistDomain } from '../store/persistDomainRead.ts'
import {
  throwIfAnyHydrateError,
  mergeProfileRow,
  mergeCarsFromRows,
  mergeClientsFromRows,
  mergeDriversFromRows,
  driverHistoryFromRows,
  mergeExpenseKind,
} from './hydrateMerge.ts'
import { mergeVehicleDayLogsFromServer } from './hydrateVehicleDayLogs.ts'
import { expenseFromFuelRecord, replaceFuelExpenses } from '../../domain/fuelRecords.ts'
import { expenseFromMaintenanceRecord, replaceMaintExpenses } from '../../domain/maintenanceRecords.ts'
import { expenseFromMiscRecord, replaceMiscExpenses } from '../../domain/miscExpenseRecords.ts'
import { mergeTaxInvoiceRecords } from '../../domain/taxInvoices.ts'
import { buildEmployedDriverSnapshot } from './hydrateEmployedDriver.ts'
import { fetchOwnerDriverExpenses } from './hydrateOwnerDriverExpenses.ts'
import { fetchOwnerDriverLinks } from '../sync/driverUnlink.ts'
import { fetchAllRows } from '../cloud/fetchAllRows.ts'
import type { DayRecordLike } from '../../domain/dayRecordTypes.ts'
import type { CarLike } from '../../domain/financeTypes.ts'
import type { ClientLike } from '../../domain/clientTypes.ts'
import type { DriverRecord } from '../../domain/driverTypes.ts'
import type { JsonRecord } from './hydrateMergeTypes.ts'
import type { InvoiceLike } from '../../domain/financeTaxInvoiceEntries.ts'
import type { ExpenseItem } from '../../domain/expenseTypes.ts'

export function hydrateFromSupabase(userId: string, ownerKey: string, options: { employedDriver?: boolean } = {}) {
  return singleFlight(`hydrate:${ownerKey}`, () => {
    const myEpoch = beginSessionEpoch(userId, ownerKey)
    return performHydrate(userId, ownerKey, myEpoch, options)
  })
}

function finishHydration(myEpoch: number, patch: { status: 'ready' | 'failed', userId: string, ownerKey: string }) {
  if (getState().hydration.epoch !== myEpoch) return
  setHydration({ ...patch, epoch: myEpoch })
}

function localThemeIfReadable(ownerKey: string) {
  const read = readPersistDomain('settings', ownerKey)
  if (!read.ok || !read.value || typeof read.value !== 'object' || Array.isArray(read.value)) return null
  if (!('theme' in read.value)) return null
  if (read.value.theme === 'dark' || read.value.theme === 'light') return read.value.theme
  return null
}

async function performHydrate(userId: string, ownerKey: string, myEpoch: number, options: { employedDriver?: boolean } = {}) {
  setHydration({ status: 'hydrating', userId, ownerKey, epoch: myEpoch })

  try {
    if (options.employedDriver) {
      const nextSnapshot = await buildEmployedDriverSnapshot({
        userId,
        ownerKey,
        throwIfAnyHydrateError,
        localDrivers: getState().drivers[ownerKey] || [],
      })
      if (isSessionStillCurrent({ userId, ownerKey, epoch: myEpoch })) {
        replaceOwnerState(ownerKey, { ...nextSnapshot, driverExpenses: [], driverHistory: [] }, { persist: false })
        finishHydration(myEpoch, { status: 'ready', userId, ownerKey })
        dropLegacyKeys(ownerKey)
      } else {
        finishHydration(myEpoch, { status: 'ready', userId, ownerKey })
      }
      return nextSnapshot
    }

    const [profileRes, vehiclesRes, clientsRes, linksRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('vehicles').select('*').eq('user_id', userId).order('display_order', { ascending: true }),
      supabase.from('clients').select('*').eq('user_id', userId).order('display_order', { ascending: true }),
      fetchOwnerDriverLinks(userId),
    ])
    throwIfAnyHydrateError({
      profiles: profileRes.error, vehicles: vehiclesRes.error, clients: clientsRes.error, driver_links: linksRes.error,
    })

    const settingsJson = (profileRes.data?.settings && typeof profileRes.data.settings === 'object') ? profileRes.data.settings : {}
    const lsTheme = localThemeIfReadable(ownerKey)
    const serverSettings = (settingsJson && typeof settingsJson === 'object') ? settingsJson : {}

    let nextWorkData: Record<string, DayRecordLike> = {}
    let nextWorkLogs: Record<string, Record<string, DayRecordLike>> = { main: {} }
    let nextCars: Array<CarLike> = []
    let nextClients: Array<ClientLike> = []
    let nextDrivers = ([]) as Array<DriverRecord>
    const restSettings = { ...serverSettings }
    delete restSettings.practiceSnapshot
    const nextSettings = normalizeSettings({
      ...restSettings,
      theme: (restSettings.theme === 'dark' || restSettings.theme === 'light') ? restSettings.theme : (lsTheme || 'light'),
    })
    let nextExpenses = ([]) as Array<JsonRecord>
    let nextInvoices = ([]) as Array<InvoiceLike>

    const nextProfile = mergeProfileRow({}, profileRes.data)
    nextCars = mergeCarsFromRows(nextCars, vehiclesRes.data || [])
    nextClients = mergeClientsFromRows(nextClients, clientsRes.data || [])
    nextDrivers = mergeDriversFromRows(getState().drivers[ownerKey] || [], nextCars, linksRes.data || [])

    const mainTombstoneKeys = Object.keys(readOwnerWorkDataTombstones(ownerKey))
    const { workLogs, mainCar } = await mergeVehicleDayLogsFromServer({
      cars: nextCars,
      mainTombstoneKeys,
      fetchDaily: (vehicleId) => fetchAllRows(() => supabase.from('daily_logs').select('*').eq('vehicle_id', vehicleId).order('id')),
      fetchTransport: (vehicleId) => fetchAllRows(() => supabase.from('transport_details').select('*').eq('vehicle_id', vehicleId).order('sequence', { ascending: true }).order('id')),
      throwIfAnyHydrateError,
    })
    nextWorkLogs = workLogs
    nextWorkData = workLogs.main || {}

    if (mainCar?.supabaseId) {
      const [fuelRes, maintRes, miscRes] = await Promise.all([
        fetchAllRows(() => supabase.from('fuel_records').select('*').eq('vehicle_id', mainCar.supabaseId).order('sequence', { ascending: true }).order('id')),
        fetchAllRows(() => supabase.from('maintenance_records').select('*').eq('vehicle_id', mainCar.supabaseId).order('sequence', { ascending: true }).order('id')),
        fetchAllRows(() => supabase.from('misc_expense_records').select('*').eq('vehicle_id', mainCar.supabaseId).order('sequence', { ascending: true }).order('id')),
      ])
      throwIfAnyHydrateError({
        fuel_records: fuelRes.error,
        maintenance_records: maintRes.error,
        misc_expense_records: miscRes.error,
      })

      nextExpenses = mergeExpenseKind({ kind: 'fuel', currentExpenses: nextExpenses, snapshotExpenses: [], previousExpenses: [], rows: fuelRes.data || [], mapRow: expenseFromFuelRecord, replace: replaceFuelExpenses })
      nextExpenses = mergeExpenseKind({ kind: 'maint', currentExpenses: nextExpenses, snapshotExpenses: [], previousExpenses: [], rows: maintRes.data || [], mapRow: expenseFromMaintenanceRecord, replace: replaceMaintExpenses })
      nextExpenses = mergeExpenseKind({ kind: 'misc', currentExpenses: nextExpenses, snapshotExpenses: [], previousExpenses: [], rows: miscRes.data || [], mapRow: expenseFromMiscRecord, replace: replaceMiscExpenses })
    }

    const { expenses: ownerExpenses, driverExpenses: nextDriverExpenses } = await fetchOwnerDriverExpenses(nextCars, nextDrivers, nextExpenses, throwIfAnyHydrateError)

    const taxInvoicesRes = await fetchAllRows(() => supabase.from('tax_invoices').select('*').eq('user_id', userId).order('id'))
    throwIfAnyHydrateError({ tax_invoices: taxInvoicesRes.error })
    nextInvoices = mergeTaxInvoiceRecords(nextInvoices, taxInvoicesRes.data || [])

    const nextSnapshot = {
      workData: nextWorkData, workLogs: nextWorkLogs, cars: nextCars, clients: nextClients, drivers: nextDrivers,
      profile: nextProfile, settings: nextSettings,
      expenses: (ownerExpenses) as ExpenseItem[],
      driverExpenses: nextDriverExpenses, driverHistory: driverHistoryFromRows(linksRes.data || [], nextCars),
      invoices: nextInvoices,
    }

    if (isSessionStillCurrent({ userId, ownerKey, epoch: myEpoch })) {
      replaceOwnerState(ownerKey, nextSnapshot, { persist: false })
      finishHydration(myEpoch, { status: 'ready', userId, ownerKey })
      dropLegacyKeys(ownerKey)
    } else {
      finishHydration(myEpoch, { status: 'ready', userId, ownerKey })
    }
    return nextSnapshot
  } catch (error) {
    finishHydration(myEpoch, { status: 'failed', userId, ownerKey })
    throw error
  } finally {
    if (getState().hydration.epoch === myEpoch && getState().hydration.status === 'hydrating') {
      finishHydration(myEpoch, { status: 'failed', userId, ownerKey })
    }
  }
}

function dropLegacyKeys(ownerKey: string) {
  try {
    localStorage.removeItem(`reactPracticeMutationOutbox:${ownerKey}`)
    localStorage.removeItem(`reactPracticeDirtyJournal:${ownerKey}`)
  } catch { }
}

export async function retryHydrate() {
  const userId = getCloudUserId()
  const ownerKey = getCloudOwnerKey()
  if (!userId || !ownerKey) return undefined
  const { checkLinkedDriverLink } = await import('../sync/driverLinkRpc.ts')
  const check = await checkLinkedDriverLink(userId)
  if (!check.ok) throw new Error('연동 확인 실패')
  const employedDriver = !!(check.link?.owner_id && String(check.link.owner_id) === String(ownerKey))
  return hydrateFromSupabase(userId, ownerKey, { employedDriver })
}
