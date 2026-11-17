import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { backfillCallDetailIds } from '../../../domain/day-record.ts'
import { pendingOwnerForLog } from '../../../data/sync/pendingLogOwner.ts'
import { getUnsafeRegistrationPatch } from '../../../data/sync/durableWriteGuard.ts'
import { getPendingDayWrite } from '../../../data/sync/pendingWorkDataWrites.ts'
import { getFailedDayLogBase, getFailedDayLogPatch } from '../../../data/sync/failedDayLogDates.ts'
import { shouldCommitDayLogToCloud, vehicleSupabaseIdForLog } from '../../../data/sync/mainDayLogRouting.ts'
import { setDayLogVersion } from '../../../data/sync/dayLogVersions.ts'
import { readOwnerLogWorkData } from '../../../data/store/ownerDataHooks.ts'
import { createDayDraftSaver } from './dayDraftLifecycle.ts'
import { dayLogReducer, initDayLogState } from './day-log-reducer.ts'
import { useToast } from '../../../shared/hooks/useToast.ts'

const RESTORED_TOAST = '저장하지 못했던 내용을 불러와 다시 저장합니다.'

export function useDayDraft(ownerKey: string, dateKey: string, logId: string = 'main') {
  const showToast = useToast()
  const [idMigration] = useState(() => {
    const stored = readOwnerLogWorkData(ownerKey, logId)[dateKey]
    const pendingOwner = pendingOwnerForLog(ownerKey, logId)
    const restored = shouldCommitDayLogToCloud(ownerKey, logId) ? getFailedDayLogPatch(ownerKey, logId, dateKey) : undefined
    const base = restored ? getFailedDayLogBase(ownerKey, logId, dateKey) : undefined
    const vehicleId = base === undefined ? null : vehicleSupabaseIdForLog(ownerKey, logId)
    if (vehicleId != null) setDayLogVersion(vehicleId, dateKey, base)
    const queued = shouldCommitDayLogToCloud(ownerKey, logId)
      ? restored
      : (getPendingDayWrite(pendingOwner, dateKey) || getUnsafeRegistrationPatch(pendingOwner, dateKey))
    return { ...backfillCallDetailIds(queued ? { ...stored, ...queued } : stored), restored: !!restored }
  })
  const [state, dispatch] = useReducer(
    dayLogReducer,
    undefined,
    () => initDayLogState(idMigration.record),
  )
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle'|'pending'|'saved'|'failed'>('idle')

  const initialDraftRef = useRef(state.draft)
  const [saver] = useState(() => createDayDraftSaver({ ownerKey, logId, dateKey, draft: state.draft, setAutoSaveStatus, keepFailedEntry: idMigration.restored }))

  useLayoutEffect(() => saver.setDraft(state.draft), [saver, state.draft])
  useEffect(() => saver.mount(), [saver])
  useEffect(() => saver.setToast(showToast), [saver, showToast])

  useEffect(() => {
    if (state.draft === initialDraftRef.current) return undefined
    saver.edited()
    return () => saver.cancelTimer()
  }, [state.draft, saver])

  useEffect(() => {
    if (idMigration.changed || idMigration.restored) saver.migrated()
  }, [idMigration.changed, idMigration.restored, saver])

  const restoredNotified = useRef(false)
  useEffect(() => {
    if (!idMigration.restored || restoredNotified.current) return
    restoredNotified.current = true
    showToast?.(RESTORED_TOAST)
  }, [idMigration.restored, showToast])

  useEffect(() => () => saver.close(), [saver])

  useEffect(() => saver.track(), [saver])

  return { draft: state.draft, editingCallId: state.editingCallId, callFormOpen: state.callFormOpen, dispatch, commitNow: saver.commitNow, autoSaveStatus }
}
