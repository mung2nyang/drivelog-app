export type WorkDataTombstones = Record<string, string>

export function addWorkDataTombstone(tombstones: WorkDataTombstones | undefined, dateKey: string): WorkDataTombstones {
  return { ...(tombstones || {}), [dateKey]: new Date().toISOString() }
}

export function removeWorkDataTombstone(tombstones: WorkDataTombstones | undefined, dateKey: string): WorkDataTombstones {
  if (!tombstones || !(dateKey in tombstones)) return tombstones || {}
  const next = { ...tombstones }
  delete next[dateKey]
  return next
}
