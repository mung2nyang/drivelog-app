import { hasPendingDayWrites, retryPendingDayWrites } from '../data/sync/pendingWorkDataWrites.ts'
import { guardBeforeUnload } from '../data/sync/durableWriteGuard.ts'
import { setPendingRetryPulse } from '../data/sync/pendingRetryPulse.ts'
import { getCloudOwnerKey } from '../data/cloud/cloudSession.ts'
import { shouldCommitDayLogToCloud } from '../data/sync/mainDayLogRouting.ts'

const RETRY_INTERVAL_MS = 5000

type EventTargetLike = {
  addEventListener: (type: string, listener: (event: Event) => void) => void,
  removeEventListener: (type: string, listener: (event: Event) => void) => void,
}

export function attachPendingWriteRetryListeners(windowTarget: EventTargetLike): () => void {
  let timer: ReturnType<typeof setInterval> | null = null

  function disarm() {
    if (!timer) return
    clearInterval(timer)
    timer = null
  }

  function arm() {
    if (timer || !hasPendingDayWrites()) return
    timer = setInterval(runRetry, RETRY_INTERVAL_MS)
  }

  function retryDisabled() {
    const ownerKey = getCloudOwnerKey()
    return !!ownerKey && shouldCommitDayLogToCloud(ownerKey, 'main')
  }

  function syncTimer() {
    if (!retryDisabled() && hasPendingDayWrites()) arm()
    else disarm()
  }

  function runRetry() {
    if (retryDisabled()) { disarm(); return }
    if (hasPendingDayWrites()) retryPendingDayWrites()
    syncTimer()
  }

  runRetry()
  windowTarget.addEventListener('online', runRetry)
  windowTarget.addEventListener('beforeunload', guardBeforeUnload)
  setPendingRetryPulse(syncTimer)
  return () => {
    setPendingRetryPulse(() => {})
    windowTarget.removeEventListener('online', runRetry)
    windowTarget.removeEventListener('beforeunload', guardBeforeUnload)
    disarm()
  }
}
