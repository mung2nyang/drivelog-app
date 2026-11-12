import { allDurableOwnerKeys, readDurable } from './durableStorage.ts'
import type { EffectivePatch } from './pendingWorkDataWritesTypes.ts'

export const KEY_SEP = String.fromCharCode(0)
export const fallback: Map<string, EffectivePatch> = new Map()
export const settledCallbacks: Map<string, (ok: boolean) => void> = new Map()

export function keyOf(ownerKey: string, dateKey: string) {
  return `${ownerKey}${KEY_SEP}${dateKey}`
}

export function computeEffectivePendingEntries(): {
  entries: Map<string, { ownerKey: string, dateKey: string, patch: EffectivePatch }>,
  unreadableOwners: Set<string>,
  ownerEnumerationFailed: boolean,
} {
  const entries: Map<string, { ownerKey: string, dateKey: string, patch: EffectivePatch }> = new Map()
  const unreadableOwners: Set<string> = new Set()
  const ownerList = allDurableOwnerKeys()
  if (ownerList.ok) {
    ownerList.owners.forEach((ownerKey) => {
      const result = readDurable(ownerKey)
      if (!result.ok) {
        unreadableOwners.add(ownerKey)
        return
      }
      Object.entries(result.value).forEach(([dateKey, patch]) => {
        entries.set(keyOf(ownerKey, dateKey), { ownerKey, dateKey, patch })
      })
    })
  }
  fallback.forEach((patch, key) => {
    const [ownerKey, dateKey] = key.split(KEY_SEP)
    entries.set(key, { ownerKey, dateKey, patch })
  })
  return { entries, unreadableOwners, ownerEnumerationFailed: !ownerList.ok }
}
