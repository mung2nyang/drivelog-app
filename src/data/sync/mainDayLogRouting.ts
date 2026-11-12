import { getState } from '../store/app-store.ts'
import { getCloudUserId } from '../cloud/cloudSession.ts'

export function vehicleSupabaseIdForLog(ownerKey: string, logId = 'main'): number | string | null {
  const cars = getState().cars[ownerKey]
  const list = Array.isArray(cars) ? cars : []
  if (!logId || logId === 'main') {
    const userId = getCloudUserId()
    const driverSession = !!userId && userId !== ownerKey
    const main = list.find((car) => car.type === 'main' && car.supabaseId) || (driverSession ? list.find((car) => car.supabaseId) : undefined)
    return main?.supabaseId ?? null
  }
  const matched = list.find((car) => car.number === logId && car.supabaseId)
  return matched?.supabaseId ?? null
}

export function shouldCommitDayLogToCloud(ownerKey: string, logId?: string) {
  if (!getCloudUserId()) return false
  return vehicleSupabaseIdForLog(ownerKey, logId) != null
}

export function hasNoCloudVehicle(ownerKey: string, logId?: string) {
  return !!getCloudUserId() && vehicleSupabaseIdForLog(ownerKey, logId) == null
}
