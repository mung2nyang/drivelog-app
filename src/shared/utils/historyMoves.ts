export type HistoryMove = { kind: 'push' } | { kind: 'replace' } | { kind: 'rewind', steps: number }

const HOME = '/app'

let startedAtHome = false
let rewinding = false

export function historyIdx() {
  const state = window.history.state
  const idx = state && typeof state === 'object' ? Reflect.get(state, 'idx') : undefined
  return typeof idx === 'number' ? idx : undefined
}

export function noteLocation(pathname: string, idx: number | undefined) {
  if (idx === 0) startedAtHome = pathname === HOME
}

export function takeRewind() {
  const was = rewinding
  rewinding = false
  return was
}

export function markRewind() {
  rewinding = true
}

export function chooseMove({ from, to, idx, startedAtHome: atHome = startedAtHome }: { from: string, to: string, idx: number | undefined, startedAtHome?: boolean }): HistoryMove {
  if (to === HOME) {
    if (from === HOME) return { kind: 'replace' }
    if (atHome && typeof idx === 'number' && idx > 0) return { kind: 'rewind', steps: idx }
    return { kind: 'replace' }
  }
  return from === HOME ? { kind: 'push' } : { kind: 'replace' }
}

let skipGuardPop = false

export function panelGuardOnTop() {
  const state = window.history.state
  const usr = state && typeof state === 'object' ? Reflect.get(state, 'usr') : undefined
  return Boolean(usr && typeof usr === 'object' && Reflect.get(usr, 'panelGuard'))
}

export function takeGuardSkip() {
  const was = skipGuardPop
  skipGuardPop = false
  return was
}

export function popPanelGuardThen(next: () => void) {
  if (!panelGuardOnTop()) { next(); return }
  skipGuardPop = true
  window.addEventListener('popstate', () => { setTimeout(next, 0) }, { once: true })
  window.history.back()
}
