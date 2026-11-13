import type { AppSession } from '../../data/sync/syncTypes.ts'

export type SessionGateResult = 'loading' | 'redirect' | 'allow'

export function resolveSessionGate({ booting, session, guestModePersisted = false }: { booting: boolean, session: AppSession | null, guestModePersisted?: boolean }): SessionGateResult {
  if (booting) return 'loading'
  if (session) return 'allow'
  if (guestModePersisted) return 'allow'
  return 'redirect'
}
