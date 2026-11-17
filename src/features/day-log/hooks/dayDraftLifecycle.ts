import { saveDayRecord } from '../../../domain/day-record.ts'
import { pendingOwnerForLog } from '../../../data/sync/pendingLogOwner.ts'
import { clearUnsafeRegistrationFailure, markUnsafeRegistrationFailure } from '../../../data/sync/durableWriteGuard.ts'
import { clearPendingDayWrite, registerPendingDayWrite } from '../../../data/sync/pendingWorkDataWrites.ts'
import { saveLogWorkDataWithTombstoneCheck } from '../../../data/sync/workDataSave.ts'
import { commitMainDayLogToCloud } from '../../../data/sync/dayLogCloudCommit.ts'
import type { DayLogCloudResult } from '../../../data/sync/dayLogCloudCommit.ts'
import { hasNoCloudVehicle, shouldCommitDayLogToCloud, vehicleSupabaseIdForLog } from '../../../data/sync/mainDayLogRouting.ts'
import { dayLogVersion } from '../../../data/sync/dayLogVersions.ts'
import { readOwnerLogWorkData } from '../../../data/store/ownerDataHooks.ts'
import { pruneDayDraft, registerDayDraft, releaseDayDraft } from '../../../data/sync/dayDraftActivity.ts'
import { addFailedDayLogDate, removeFailedDayLogDate } from '../../../data/sync/failedDayLogDates.ts'
import { DEVICE_SAVE_FAIL, NO_VEHICLE_SAVE_FAIL, SERVER_SAVE_FAIL } from '../../../shared/utils/failureMessages.ts'
import type { EffectivePatch } from '../../../data/sync/pendingWorkDataWritesTypes.ts'
import type { DayRecordLike } from '../../../domain/dayRecordTypes.ts'
import type { DayDraft } from './day-log-reducer.ts'

export type WorkMap = Record<string, DayRecordLike>
export type AutoSaveState = 'idle'|'pending'|'saved'|'failed'
export type SetAutoSaveState = (status: AutoSaveState) => void
export type SaveProgress = { hasPending: boolean, draftRev: number, mounted: boolean }

const DEBOUNCE_MS = 600

function queueFailedDayWrite(ownerKey: string, dateKey: string, patch: EffectivePatch, onSettled: (ok: boolean) => void) {
  const registered = registerPendingDayWrite(ownerKey, dateKey, patch, onSettled)
  if (registered) clearUnsafeRegistrationFailure(ownerKey, dateKey)
  else markUnsafeRegistrationFailure(ownerKey, dateKey, patch)
}

export function settlePendingDayWrite(progress: SaveProgress, setAutoSaveStatus: SetAutoSaveState, attemptRev: number, ok: boolean) {
  if (!ok || attemptRev !== progress.draftRev) return
  progress.hasPending = false
  if (progress.mounted) setAutoSaveStatus('saved')
}

type DayDraftSaverOptions = {
  ownerKey: string
  logId: string
  dateKey: string
  draft: DayDraft
  setAutoSaveStatus: SetAutoSaveState
  keepFailedEntry?: boolean
}

export function createDayDraftSaver({ ownerKey, logId, dateKey, draft: initialDraft, setAutoSaveStatus, keepFailedEntry = false }: DayDraftSaverOptions) {
  const pendingOwner = pendingOwnerForLog(ownerKey, logId)
  const progress: SaveProgress = { hasPending: false, draftRev: 0, mounted: true }
  let timer: ReturnType<typeof setTimeout>|null = null
  let saving = false
  let again = false
  let activity: symbol|null = null
  let toast: ((message: string) => void) | undefined
  let latestDraft = initialDraft
  let locked = false
  const dayLabel = `${Number(dateKey.slice(5, 7))}월 ${Number(dateKey.slice(8, 10))}일 운행일지`
  const failHead = `${dayLabel} `
  if (!keepFailedEntry) removeFailedDayLogDate(ownerKey, logId, dateKey)

  function markSaved(patch: EffectivePatch) {
    progress.hasPending = false
    clearUnsafeRegistrationFailure(pendingOwner, dateKey)
    clearPendingDayWrite(pendingOwner, dateKey, patch)
    if (progress.mounted) setAutoSaveStatus('saved')
  }

  function commitLocal(latest: WorkMap, next: WorkMap, patch: EffectivePatch) {
    try {
      saveLogWorkDataWithTombstoneCheck(ownerKey, logId, dateKey, latest, next)
    } catch (error) {
      if (progress.mounted) setAutoSaveStatus('failed')
      toast?.(failHead + DEVICE_SAVE_FAIL)
      console.error('일지 자동 저장 실패:', error)
      const attemptRev = progress.draftRev
      queueFailedDayWrite(pendingOwner, dateKey, patch, (ok) => settlePendingDayWrite(progress, setAutoSaveStatus, attemptRev, ok))
      return
    }
    markSaved(patch)
  }

  function knownBase() {
    const vehicleId = vehicleSupabaseIdForLog(ownerKey, logId)
    return vehicleId == null ? null : dayLogVersion(vehicleId, dateKey)
  }

  function settleConflict(reloaded: boolean) {
    locked = true
    again = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    removeFailedDayLogDate(ownerKey, logId, dateKey)
    addFailedDayLogDate(ownerKey, logId, dateKey)
    toast?.(`${dayLabel}는 다른 기기에서 먼저 고쳐 저장하지 못했습니다. ${reloaded ? '일지를 닫았다가 다시 열면 최신 내용이 보입니다.' : '앱을 다시 켜서 최신 내용을 확인해 주세요.'}`)
    if (progress.mounted) setAutoSaveStatus('failed')
  }

  function settleCloud(result: Omit<DayLogCloudResult, 'cloud'>, attemptRev: number, patch: EffectivePatch) {
    if (result.ok) {
      if (attemptRev !== progress.draftRev) return
      removeFailedDayLogDate(ownerKey, logId, dateKey)
      markSaved(patch)
      return
    }
    if (result.conflict) {
      settleConflict(!!result.reloaded)
      return
    }
    addFailedDayLogDate(ownerKey, logId, dateKey, patch, knownBase())
    if (result.toast) toast?.(result.toast === SERVER_SAVE_FAIL ? failHead + result.toast : result.toast)
    if (!progress.mounted) return
    setAutoSaveStatus('failed')
    markUnsafeRegistrationFailure(pendingOwner, dateKey, patch)
  }

  function commitNow() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (locked) return
    const draft = latestDraft
    const latest = readOwnerLogWorkData(ownerKey, logId)
    const patch = structuredClone({
      isOff: draft.isOff,
      fixedCount: draft.fixedCount,
      palletCount: draft.palletCount,
      callDetails: draft.callDetails,
      fixedRouteCounts: draft.fixedRouteCounts,
    })
    const next = saveDayRecord(latest, dateKey, patch)
    if (!shouldCommitDayLogToCloud(ownerKey, logId)) {
      if (hasNoCloudVehicle(ownerKey, logId)) settleCloud({ ok: false, toast: NO_VEHICLE_SAVE_FAIL }, progress.draftRev, patch)
      else commitLocal(latest, next, patch)
      return
    }
    if (saving) { again = true; return }
    saving = true
    const attemptRev = progress.draftRev
    void commitMainDayLogToCloud({ ownerKey, logId, dateKey, previousData: latest, nextData: next }).then((result) => {
      saving = false
      if (!result.cloud) commitLocal(latest, next, patch)
      else settleCloud(result, attemptRev, patch)
      if (again) {
        again = false
        commitNow()
      }
      if (activity) pruneDayDraft(activity)
    })
  }

  return {
    commitNow,
    setToast(next: ((message: string) => void) | undefined) { toast = next },
    setDraft(next: DayDraft) { latestDraft = next },
    mount() {
      progress.mounted = true
      return () => { progress.mounted = false }
    },
    edited() {
      progress.draftRev += 1
      if (locked) {
        if (progress.mounted) setAutoSaveStatus('failed')
        return
      }
      setAutoSaveStatus('pending')
      progress.hasPending = true
      if (timer) clearTimeout(timer)
      timer = setTimeout(commitNow, DEBOUNCE_MS)
    },
    cancelTimer() {
      if (timer) clearTimeout(timer)
    },
    migrated() {
      progress.hasPending = true
      commitNow()
    },
    close() {
      if (shouldCommitDayLogToCloud(ownerKey, logId)) clearUnsafeRegistrationFailure(pendingOwner, dateKey)
      if (progress.hasPending) commitNow()
    },
    track() {
      const token = registerDayDraft(() => timer !== null || saving, () => { if (timer) commitNow() })
      activity = token
      return () => releaseDayDraft(token)
    },
  }
}
