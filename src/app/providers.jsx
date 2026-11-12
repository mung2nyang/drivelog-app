// @ts-check
import { useEffect } from 'react'
import { attachPendingWriteRetryListeners } from './pendingWriteRetryListeners.js'

/** @returns {null} */
export function PendingWriteRetryBridge() {
  useEffect(() => attachPendingWriteRetryListeners(window), [])

  return null
}
