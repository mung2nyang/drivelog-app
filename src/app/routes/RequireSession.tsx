import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { resolveSessionGate } from './sessionGate.ts'
import { isGuestModePersisted } from '../guestSessionPersist.ts'
import LoadingScreen from '../shell/LoadingScreen.tsx'
import { useSession } from '../../data/cloud/sessionContext.ts'

export default function RequireSession({ booting, children }: { booting: boolean, children: ReactNode }) {
  const { session } = useSession()
  const gate = resolveSessionGate({ booting, session: session ?? null, guestModePersisted: isGuestModePersisted() })
  if (gate === 'loading') return <LoadingScreen />
  if (gate === 'redirect') return <Navigate to="/auth" replace />
  return children
}
