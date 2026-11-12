export type DayDraftEntry = { isBusy: () => boolean, flush: () => void, released: boolean }

const entries: Map<symbol, DayDraftEntry> = new Map()
let listening = false

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') flushDayDrafts()
}

function listenOnce() {
  if (listening || typeof window === 'undefined' || typeof document === 'undefined') return
  listening = true
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', flushDayDrafts)
}

export function registerDayDraft(isBusy: () => boolean, flush: () => void): symbol {
  listenOnce()
  const token = Symbol('dayDraft')
  entries.set(token, { isBusy, flush, released: false })
  return token
}

export function releaseDayDraft(token: symbol) {
  const entry = entries.get(token)
  if (!entry) return
  entry.released = true
  pruneDayDraft(token)
}

export function pruneDayDraft(token: symbol) {
  const entry = entries.get(token)
  if (entry?.released && !entry.isBusy()) entries.delete(token)
}

export function flushDayDrafts() {
  for (const entry of [...entries.values()]) {
    if (entry.isBusy()) entry.flush()
  }
}

export function hasBusyDayDraft() {
  return [...entries.values()].some((entry) => entry.isBusy())
}
