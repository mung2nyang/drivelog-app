// @ts-check
import { saveDayRecord } from '../../../domain/day-record.ts'
import { pendingOwnerForLog } from '../../../data/sync/pendingLogOwner.ts'
import { clearUnsafeRegistrationFailure, markUnsafeRegistrationFailure } from '../../../data/sync/durableWriteGuard.ts'
import { clearPendingDayWrite, registerPendingDayWrite } from '../../../data/sync/pendingWorkDataWrites.ts'
import { saveLogWorkDataWithTombstoneCheck } from '../../../data/sync/workDataSave.ts'
import { commitMainDayLogToCloud } from '../../../data/sync/dayLogCloudCommit.ts'
import { hasNoCloudVehicle, shouldCommitDayLogToCloud } from '../../../data/sync/mainDayLogRouting.ts'
import { readOwnerLogWorkData } from '../../../data/store/ownerDataHooks.ts'
import { pruneDayDraft, registerDayDraft, releaseDayDraft } from '../../../data/sync/dayDraftActivity.ts'
import { addFailedDayLogDate, removeFailedDayLogDate } from '../../../data/sync/failedDayLogDates.ts'
import { DEVICE_SAVE_FAIL, NO_VEHICLE_SAVE_FAIL, SERVER_SAVE_FAIL } from '../../../shared/utils/failureMessages.ts'

/** @typedef {import('../../../data/sync/pendingWorkDataWritesTypes.ts').EffectivePatch} EffectivePatch */
/** @typedef {Record<string, import('../../../domain/dayRecordTypes.ts').DayRecordLike>} WorkMap */
/** @typedef {import('./day-log-reducer.js').DayDraft} DayDraft */
/** @typedef {'idle'|'pending'|'saved'|'failed'} AutoSaveState */
/** @typedef {(status: AutoSaveState) => void} SetAutoSaveState */
/** @typedef {{ hasPending: boolean, draftRev: number, mounted: boolean }} SaveProgress */

const DEBOUNCE_MS = 600

/**
 * @param {string} ownerKey
 * @param {string} dateKey
 * @param {EffectivePatch} patch
 * @param {(ok: boolean) => void} onSettled
 */
function queueFailedDayWrite(ownerKey, dateKey, patch, onSettled) {
  const registered = registerPendingDayWrite(ownerKey, dateKey, patch, onSettled)
  if (registered) clearUnsafeRegistrationFailure(ownerKey, dateKey)
  else markUnsafeRegistrationFailure(ownerKey, dateKey, patch)
}

/**
 * @param {SaveProgress} progress
 * @param {SetAutoSaveState} setAutoSaveStatus
 * @param {number} attemptRev
 * @param {boolean} ok
 */
export function settlePendingDayWrite(progress, setAutoSaveStatus, attemptRev, ok) {
  if (!ok || attemptRev !== progress.draftRev) return
  progress.hasPending = false
  if (progress.mounted) setAutoSaveStatus('saved')
}

/**
 * @param {{ ownerKey: string, logId: string, dateKey: string,
 *   draft: DayDraft, setAutoSaveStatus: SetAutoSaveState }} options
 */
export function createDayDraftSaver({ ownerKey, logId, dateKey, draft: initialDraft, setAutoSaveStatus }) {
  const pendingOwner = pendingOwnerForLog(ownerKey, logId)
  /** @type {SaveProgress} */
  const progress = { hasPending: false, draftRev: 0, mounted: true }
  /** @type {ReturnType<typeof setTimeout>|null} */
  let timer = null
  let saving = false
  let again = false
  /** @type {symbol|null} */
  let activity = null
  /** @type {((message: string) => void)|undefined} */
  let toast
  let latestDraft = initialDraft
  const failHead = `${Number(dateKey.slice(5, 7))}월 ${Number(dateKey.slice(8, 10))}일 운행일지 `
  removeFailedDayLogDate(ownerKey, logId, dateKey)

  /** @param {EffectivePatch} patch */
  function markSaved(patch) {
    progress.hasPending = false
    clearUnsafeRegistrationFailure(pendingOwner, dateKey)
    clearPendingDayWrite(pendingOwner, dateKey, patch)
    if (progress.mounted) setAutoSaveStatus('saved')
  }

  /** @param {WorkMap} latest @param {WorkMap} next @param {EffectivePatch} patch */
  function commitLocal(latest, next, patch) {
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

  /** @param {{ ok: boolean, toast: string|null }} result @param {number} attemptRev @param {EffectivePatch} patch */
  function settleCloud(result, attemptRev, patch) {
    if (result.ok) {
      if (attemptRev !== progress.draftRev) return
      removeFailedDayLogDate(ownerKey, logId, dateKey)
      markSaved(patch)
      return
    }
    addFailedDayLogDate(ownerKey, logId, dateKey)
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
    /** @param {((message: string) => void)|undefined} next */
    setToast(next) { toast = next },
    /** @param {DayDraft} next */
    setDraft(next) { latestDraft = next },
    mount() {
      progress.mounted = true
      return () => { progress.mounted = false }
    },
    edited() {
      progress.draftRev += 1
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
