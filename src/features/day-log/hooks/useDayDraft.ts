import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { backfillCallDetailIds } from '../../../domain/day-record.ts'
import { pendingOwnerForLog } from '../../../data/sync/pendingLogOwner.ts'
import { getUnsafeRegistrationPatch } from '../../../data/sync/durableWriteGuard.ts'
import { getPendingDayWrite } from '../../../data/sync/pendingWorkDataWrites.ts'
import { shouldCommitDayLogToCloud } from '../../../data/sync/mainDayLogRouting.ts'
import { readOwnerLogWorkData } from '../../../data/store/ownerDataHooks.ts'
import { createDayDraftSaver } from './dayDraftLifecycle.ts'
import { dayLogReducer, initDayLogState } from './day-log-reducer.ts'
import { useToast } from '../../../shared/hooks/useToast.ts'

export function useDayDraft(ownerKey: string, dateKey: string, logId: string = 'main') {
  const showToast = useToast()
  const [idMigration] = useState(() => {
    const stored = readOwnerLogWorkData(ownerKey, logId)[dateKey]
    const pendingOwner = pendingOwnerForLog(ownerKey, logId)
    const queued = shouldCommitDayLogToCloud(ownerKey, logId)
      ? null
      : (getPendingDayWrite(pendingOwner, dateKey) || getUnsafeRegistrationPatch(pendingOwner, dateKey))
    return backfillCallDetailIds(queued ? { ...stored, ...queued } : stored)
  })
  const [state, dispatch] = useReducer(
    dayLogReducer,
    undefined,
    () => initDayLogState(idMigration.record),
  )
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle'|'pending'|'saved'|'failed'>('idle')

  const initialDraftRef = useRef(state.draft)
  const [saver] = useState(() => createDayDraftSaver({ ownerKey, logId, dateKey, draft: state.draft, setAutoSaveStatus }))

  useLayoutEffect(() => saver.setDraft(state.draft), [saver, state.draft])
  useEffect(() => saver.mount(), [saver])
  useEffect(() => saver.setToast(showToast), [saver, showToast])

  useEffect(() => {
    if (state.draft === initialDraftRef.current) return undefined
    saver.edited()
    return () => saver.cancelTimer()
  }, [state.draft, saver])

  useEffect(() => {
    if (idMigration.changed) saver.migrated()
  }, [idMigration.changed, saver])

  useEffect(() => () => saver.close(), [saver])

  useEffect(() => saver.track(), [saver])

  return { draft: state.draft, editingCallId: state.editingCallId, callFormOpen: state.callFormOpen, dispatch, commitNow: saver.commitNow, autoSaveStatus }
}
