import { useSyncExternalStore } from 'react'
import { getState, subscribe } from './app-store.ts'
import type { DayRecordLike } from '../../domain/calendarBadges.ts'
import type { WorkDataByLogId } from '../../domain/financeTypes.ts'
import type { WorkDataTombstones } from '../../domain/workDataTombstones.ts'

const EMPTY_WORK_DATA = ({}) as Record<string, DayRecordLike>
const EMPTY_WORK_DATA_BY_LOG_ID = ({
  main: EMPTY_WORK_DATA,
}) as WorkDataByLogId

export function readOwnerWorkData(ownerKey: string): Record<string, DayRecordLike> {
  return getState().workLogs[ownerKey]?.main || EMPTY_WORK_DATA
}

export function readOwnerLogWorkData(ownerKey: string, logId = 'main'): Record<string, DayRecordLike> {
  if (!logId || logId === 'main') return readOwnerWorkData(ownerKey)
  return getState().workLogs[ownerKey]?.[logId] || EMPTY_WORK_DATA
}

export function useOwnerWorkData(ownerKey: string): Record<string, DayRecordLike> {
  return useSyncExternalStore(subscribe, () => readOwnerWorkData(ownerKey))
}

export function readOwnerWorkDataByLogId(ownerKey: string): WorkDataByLogId {
  const logs = getState().workLogs[ownerKey]
  if (!logs || typeof logs !== 'object') return EMPTY_WORK_DATA_BY_LOG_ID
  return logs
}

export function useOwnerWorkDataByLogId(ownerKey: string) {
  return useSyncExternalStore(subscribe, () => readOwnerWorkDataByLogId(ownerKey))
}

const EMPTY_TOMBSTONES = ({}) as WorkDataTombstones

export function readOwnerWorkDataTombstones(ownerKey: string): WorkDataTombstones {
  const raw = (getState().workDataDeletedDates[ownerKey]) as WorkDataTombstones | undefined
  return raw || EMPTY_TOMBSTONES
}
