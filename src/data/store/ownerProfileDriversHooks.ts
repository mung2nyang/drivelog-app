import { useMemo, useSyncExternalStore } from 'react'
import { EMPTY_PROFILE } from '../sync/profileSave.ts'
import { getState, subscribe } from './app-store.ts'
import type { DriverRecord } from '../../domain/driverTypes.ts'

const EMPTY_DRIVERS = ([]) as Array<DriverRecord>

export function readOwnerProfile(ownerKey: string) {
  const raw = getState().profile[ownerKey]
  if (!raw || typeof raw !== 'object') return EMPTY_PROFILE
  return { ...EMPTY_PROFILE, ...raw }
}

export function useOwnerProfile(ownerKey: string) {
  const raw = useSyncExternalStore(subscribe, () => getState().profile[ownerKey])
  return useMemo(
    () => (raw && typeof raw === 'object' ? { ...EMPTY_PROFILE, ...raw } : EMPTY_PROFILE),
    [raw],
  )
}

export function readOwnerDrivers(ownerKey: string) {
  return getState().drivers[ownerKey] || EMPTY_DRIVERS
}

export function useOwnerDrivers(ownerKey: string) {
  return useSyncExternalStore(subscribe, () => readOwnerDrivers(ownerKey))
}
