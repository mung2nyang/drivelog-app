import { useSyncExternalStore } from 'react'
import { getState, subscribe } from './app-store.ts'
import type { DriverLinkLike } from '../../domain/financeTypes.ts'

const EMPTY_DRIVER_HISTORY = ([]) as Array<DriverLinkLike>

export function readOwnerDriverHistory(ownerKey: string): Array<DriverLinkLike> {
  return getState().driverHistory[ownerKey] || EMPTY_DRIVER_HISTORY
}

export function useOwnerDriverHistory(ownerKey: string): Array<DriverLinkLike> {
  return useSyncExternalStore(subscribe, () => readOwnerDriverHistory(ownerKey))
}
