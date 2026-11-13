import { useEffect } from 'react'
import { attachPendingWriteRetryListeners } from './pendingWriteRetryListeners.ts'

export function PendingWriteRetryBridge(): null {
  useEffect(() => attachPendingWriteRetryListeners(window), [])

  return null
}
