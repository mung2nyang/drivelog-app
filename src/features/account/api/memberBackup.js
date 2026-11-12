// @ts-check
/** @typedef {import('../../../domain/jsonTypes.ts').JsonValue} JsonValue */
import {
  readOwnerCars,
  readOwnerClients,
  readOwnerDrivers,
  readOwnerExpenses,
  readOwnerInvoices,
  readOwnerProfile,
  readOwnerSettings,
  readOwnerWorkDataByLogId,
} from '../../../data/store/ownerDataHooks.ts'
import { getCloudOwnerKey, isHydrationReady } from '../../../data/cloud/cloudSession.ts'
import { fetchVehiclesDailyInspections } from '../../../data/sync/dailyInspections.ts'

/**
 * @param {string} ownerKey
 * @returns {string|null}
 */
export function memberBackupBlockedReason(ownerKey) {
  if (!ownerKey || getCloudOwnerKey() !== ownerKey || !isHydrationReady()) {
    return '기록을 아직 불러오는 중입니다. 잠시 후 다시 시도해 주세요.'
  }
  return null
}

/**
 * @param {string} ownerKey
 * @returns {Promise<Record<string, JsonValue>>}
 */
export async function buildMemberBackupData(ownerKey) {
  const cars = readOwnerCars(ownerKey)
  const workLogs = readOwnerWorkDataByLogId(ownerKey)
  const vehicleIds = cars.map((car) => car?.supabaseId).filter((id) => id != null && id !== '')
  const byVehicleId = await fetchVehiclesDailyInspections(/** @type {Array<string|number>} */ (vehicleIds))
  /** @type {Record<string, JsonValue>} */
  const dailyInspections = {}
  for (const car of cars) {
    const id = car?.supabaseId
    if (id == null || !byVehicleId[String(id)]) continue
    dailyInspections[car.type === 'sub' && car.number ? car.number : 'main'] = byVehicleId[String(id)]
  }
  return {
    backupType: 'react_practice_backup',
    version: 1,
    createdAt: new Date().toISOString(),
    cars,
    clients: readOwnerClients(ownerKey),
    settings: readOwnerSettings(ownerKey),
    expenses: readOwnerExpenses(ownerKey),
    invoices: readOwnerInvoices(ownerKey),
    drivers: readOwnerDrivers(ownerKey),
    profile: readOwnerProfile(ownerKey),
    workData: workLogs.main || {},
    workLogs,
    dailyInspections,
  }
}
