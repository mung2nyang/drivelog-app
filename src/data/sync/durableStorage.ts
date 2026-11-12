import { isValidCalendarDateKey } from '../../domain/dateKey.ts'
import { isValidPatch } from './durablePatchSchema.ts'
import type { JsonValue } from '../../domain/jsonTypes.ts'
import type { DurableReadResult, EffectivePatch, OwnerEnumerationResult } from './pendingWorkDataWritesTypes.ts'

const DURABLE_KEY_PREFIX = 'reactPracticeDurablePendingWrites'

export function durableKey(ownerKey: string) {
  return `${DURABLE_KEY_PREFIX}:${ownerKey}`
}

export function readDurable(ownerKey: string): DurableReadResult {
  let raw
  try {
    raw = localStorage.getItem(durableKey(ownerKey))
  } catch {
    return { ok: false }
  }
  if (raw === null) return { ok: true, value: {} }
  let parsed
  try {
    parsed = (JSON.parse(raw)) as JsonValue
  } catch {
    return { ok: false }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ok: false }
  for (const [dateKey, patch] of Object.entries(parsed)) {
    if (!isValidCalendarDateKey(dateKey)) return { ok: false }
    if (!isValidPatch(patch)) return { ok: false }
  }
  return { ok: true, value: (parsed) as Record<string, EffectivePatch> }
}

export function writeDurable(ownerKey: string, value: Record<string, EffectivePatch>) {
  localStorage.setItem(durableKey(ownerKey), JSON.stringify(value))
}

export function allDurableOwnerKeys(): OwnerEnumerationResult {
  const owners: Set<string> = new Set()
  let length
  try {
    length = localStorage.length
  } catch {
    return { ok: false }
  }
  for (let i = 0; i < length; i += 1) {
    let key
    try {
      key = localStorage.key(i)
    } catch {
      return { ok: false }
    }
    if (key?.startsWith(`${DURABLE_KEY_PREFIX}:`)) owners.add(key.slice(DURABLE_KEY_PREFIX.length + 1))
  }
  return { ok: true, owners: [...owners] }
}
