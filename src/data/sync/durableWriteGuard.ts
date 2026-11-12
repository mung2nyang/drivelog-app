import { hasUnsafePendingWrites } from './pendingWorkDataWrites.ts'
import { pulsePendingRetry } from './pendingRetryPulse.ts'
import { flushDayDrafts, hasBusyDayDraft } from './dayDraftActivity.ts'
import type { EffectivePatch } from './pendingWorkDataWritesTypes.ts'

const KEY_SEP = String.fromCharCode(0)
const unsafeUnregistered: Map<string, EffectivePatch> = new Map()

function keyOf(ownerKey: string, dateKey: string) {
  return `${ownerKey}${KEY_SEP}${dateKey}`
}

function splitKey(key: string) {
  const sep = key.indexOf(KEY_SEP)
  return { ownerKey: key.slice(0, sep), dateKey: key.slice(sep + 1) }
}

export function markUnsafeRegistrationFailure(ownerKey: string, dateKey: string, patch: EffectivePatch) {
  unsafeUnregistered.set(keyOf(ownerKey, dateKey), patch)
  pulsePendingRetry()
}

export function clearUnsafeRegistrationFailure(ownerKey: string, dateKey: string) {
  unsafeUnregistered.delete(keyOf(ownerKey, dateKey))
  pulsePendingRetry()
}

export function hasUnsafeRegistration(ownerKey: string, dateKey: string) {
  return unsafeUnregistered.has(keyOf(ownerKey, dateKey))
}

export function getUnsafeRegistrationPatch(ownerKey: string, dateKey: string): EffectivePatch | undefined {
  return unsafeUnregistered.get(keyOf(ownerKey, dateKey))
}

export function hasAnyUnsafeRegistration() {
  return unsafeUnregistered.size > 0
}

export function listUnsafeRegistrations(): Array<{ ownerKey: string, dateKey: string, patch: EffectivePatch }> {
  return [...unsafeUnregistered].map(([key, patch]) => ({ ...splitKey(key), patch }))
}

export function isDurableWriteBroken() {
  return hasUnsafePendingWrites() || unsafeUnregistered.size > 0
}

export function guardBeforeUnload(event: { preventDefault: () => void, returnValue?: boolean }) {
  flushDayDrafts()
  if (!isDurableWriteBroken() && !hasBusyDayDraft()) return
  event.preventDefault()
  event.returnValue = true
}

export function confirmLeaveIfUnsafe(): boolean {
  if (!isDurableWriteBroken()) return true
  return window.confirm('방금 고친 내용이 아직 저장되지 않았습니다. 그래도 나가시겠습니까?')
}

export function confirmReloadIfUnsaved(): boolean {
  flushDayDrafts()
  if (hasBusyDayDraft()) return window.confirm('방금 고친 내용을 아직 저장하는 중입니다. 그래도 나가시겠습니까?')
  return confirmLeaveIfUnsafe()
}
