import { commitBatch } from '../store/app-store.ts'
import { commitLogWorkData, commitWorkData } from '../store/commitHelpers.ts'
import { readOwnerWorkDataTombstones } from '../store/ownerDataHooks.ts'
import { addWorkDataTombstone, removeWorkDataTombstone } from '../../domain/workDataTombstones.ts'
import type { DayRecordLike } from '../../domain/dayRecordTypes.ts'
import type { WorkDataTombstones } from '../../domain/workDataTombstones.ts'

export function saveWorkData(ownerKey: string, data: Record<string, DayRecordLike>) {
  commitWorkData(ownerKey, data)
}

export function saveWorkDataWithTombstoneCheck(ownerKey: string, dateKey: string, previousData: Record<string, DayRecordLike>, nextData: Record<string, DayRecordLike>) {
  const hadRecordBefore = !!previousData[dateKey]
  const hasRecordNow = !!nextData[dateKey]
  const existingTombstones = readOwnerWorkDataTombstones(ownerKey)
  const hadTombstone = dateKey in existingTombstones

  let nextTombstones: WorkDataTombstones | null = null
  if (!hasRecordNow && hadRecordBefore) nextTombstones = addWorkDataTombstone(existingTombstones, dateKey)
  else if (hasRecordNow && hadTombstone) nextTombstones = removeWorkDataTombstone(existingTombstones, dateKey)

  if (!nextTombstones) {
    saveWorkData(ownerKey, nextData)
    return
  }
  commitBatch([
    { domain: 'workData', ownerKey, value: nextData },
    { domain: 'workDataDeletedDates', ownerKey, value: nextTombstones },
  ])
}

export function saveLogWorkDataWithTombstoneCheck(ownerKey: string, logId: string, dateKey: string, previousData: Record<string, DayRecordLike>, nextData: Record<string, DayRecordLike>) {
  if (!logId || logId === 'main') {
    saveWorkDataWithTombstoneCheck(ownerKey, dateKey, previousData, nextData)
    return
  }
  commitLogWorkData(ownerKey, logId, nextData)
}
