/** @typedef {'loading' | 'redirect' | 'allow'} SessionGateResult */

/** @typedef {import('../../data/sync/syncTypes.ts').AppSession} AppSession */

/**
 * @param {{ booting: boolean, session: AppSession | null, guestModePersisted?: boolean }} args
 * @returns {SessionGateResult}
 */
export function resolveSessionGate({ booting, session, guestModePersisted = false }) {
  if (booting) return 'loading'
  if (session) return 'allow'
  if (guestModePersisted) return 'allow'
  return 'redirect'
}
