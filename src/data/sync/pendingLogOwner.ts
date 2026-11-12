export const LOG_OWNER_MARK = '::log::'

export function pendingOwnerForLog(ownerKey: string, logId = 'main') {
  if (!logId || logId === 'main') return ownerKey
  return `${ownerKey}${LOG_OWNER_MARK}${encodeURIComponent(logId)}`
}

export function parsePendingOwner(stored: string): { ownerKey: string, logId: string } {
  const index = stored.indexOf(LOG_OWNER_MARK)
  if (index < 0) return { ownerKey: stored, logId: 'main' }
  return {
    ownerKey: stored.slice(0, index),
    logId: decodeURIComponent(stored.slice(index + LOG_OWNER_MARK.length)),
  }
}
