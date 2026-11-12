import { isValidCalendarDateKey } from '../../domain/dateKey.ts'
import { saveDayRecord } from '../../domain/day-record.ts'
import { readOwnerLogWorkData } from '../store/ownerDataHooks.ts'
import { commitLogWorkData } from '../store/commitHelpers.ts'
import { readDurable, writeDurable } from './durableStorage.ts'
import { isValidPatch } from './durablePatchSchema.ts'
import { pulsePendingRetry } from './pendingRetryPulse.ts'
import { parsePendingOwner } from './pendingLogOwner.ts'
import { saveWorkDataWithTombstoneCheck } from './workDataSave.ts'
import {
  computeEffectivePendingEntries, fallback, keyOf, settledCallbacks,
} from './pendingWorkDataWritesState.ts'
import type { EffectivePatch } from './pendingWorkDataWritesTypes.ts'

export function registerPendingDayWrite(ownerKey: string, dateKey: string, patch: EffectivePatch, onSettled?: (ok: boolean) => void): boolean {
  if (!isValidCalendarDateKey(dateKey) || !isValidPatch(patch)) return false
  try {
    if (onSettled) settledCallbacks.set(keyOf(ownerKey, dateKey), onSettled)
    const current = readDurable(ownerKey)
    if (!current.ok) {
      fallback.set(keyOf(ownerKey, dateKey), patch)
      return true
    }
    try {
      const next = { ...current.value, [dateKey]: patch }
      writeDurable(ownerKey, next)
      fallback.delete(keyOf(ownerKey, dateKey))
    } catch {
      fallback.set(keyOf(ownerKey, dateKey), patch)
    }
    return true
  } finally {
    pulsePendingRetry()
  }
}

export function clearPendingDayWrite(ownerKey: string, dateKey: string, effectivePatch: EffectivePatch): boolean {
  try {
    const current = readDurable(ownerKey)
    if (!current.ok) {
      fallback.set(keyOf(ownerKey, dateKey), effectivePatch)
      return false
    }
    const next = current.value
    const hadDurableEntry = dateKey in next
    let durableCleanupOk = true
    if (hadDurableEntry) {
      delete next[dateKey]
      try {
        writeDurable(ownerKey, next)
      } catch {
        durableCleanupOk = false
      }
    }
    if (!durableCleanupOk) {
      fallback.set(keyOf(ownerKey, dateKey), effectivePatch)
      return false
    }
    fallback.delete(keyOf(ownerKey, dateKey))
    settledCallbacks.delete(keyOf(ownerKey, dateKey))
    return true
  } finally {
    pulsePendingRetry()
  }
}

export function getPendingDayWrite(ownerKey: string, dateKey: string): EffectivePatch | undefined {
  const fromFallback = fallback.get(keyOf(ownerKey, dateKey))
  if (fromFallback) return fromFallback
  const current = readDurable(ownerKey)
  return current.ok ? current.value[dateKey] : undefined
}

export function hasUnsafePendingWrites() {
  if (fallback.size > 0) return true
  const { unreadableOwners, ownerEnumerationFailed } = computeEffectivePendingEntries()
  return ownerEnumerationFailed || unreadableOwners.size > 0
}

export function hasPendingDayWrites() {
  const { entries, unreadableOwners, ownerEnumerationFailed } = computeEffectivePendingEntries()
  return entries.size > 0 || unreadableOwners.size > 0 || ownerEnumerationFailed
}

export function pendingDayWriteCount() {
  const { entries, unreadableOwners, ownerEnumerationFailed } = computeEffectivePendingEntries()
  let count = entries.size
  if (unreadableOwners.size > 0) {
    const coveredOwners = new Set([...entries.values()].map((entry) => entry.ownerKey))
    unreadableOwners.forEach((ownerKey) => { if (!coveredOwners.has(ownerKey)) count += 1 })
  }
  if (ownerEnumerationFailed) count += 1
  return count
}

export function retryPendingDayWrites() {
  const { entries, unreadableOwners, ownerEnumerationFailed } = computeEffectivePendingEntries()
  if (ownerEnumerationFailed) return

  entries.forEach(({ ownerKey, dateKey, patch }) => {
    if (unreadableOwners.has(ownerKey)) return
    try {
      const parsed = parsePendingOwner(ownerKey)
      const latest = readOwnerLogWorkData(parsed.ownerKey, parsed.logId)
      const next = saveDayRecord(latest, dateKey, patch)
      if (!parsed.logId || parsed.logId === 'main') {
        saveWorkDataWithTombstoneCheck(parsed.ownerKey, dateKey, latest, next)
      } else {
        commitLogWorkData(parsed.ownerKey, parsed.logId, next)
      }
      const onSettled = settledCallbacks.get(keyOf(ownerKey, dateKey))
      const cleared = clearPendingDayWrite(ownerKey, dateKey, patch)
      if (cleared) onSettled?.(true)
    } catch {
    }
  })
}
