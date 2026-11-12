// @ts-check
import { Navigate } from 'react-router-dom'
import { resolveSessionGate } from './sessionGate.js'
import { isGuestModePersisted } from '../guestSessionPersist.js'
import LoadingScreen from '../shell/LoadingScreen.jsx'
import { useSession } from '../../data/cloud/sessionContext.ts'

/** @typedef {import('../../data/sync/syncTypes.ts').AppSession} AppSession */

/**
 * @param {Object} props
 * @param {boolean} props.booting
 * @param {import('react').ReactNode} props.children
 */
export default function RequireSession({ booting, children }) {
  const { session } = useSession()
  const gate = resolveSessionGate({ booting, session: session ?? null, guestModePersisted: isGuestModePersisted() })
  if (gate === 'loading') return <LoadingScreen />
  if (gate === 'redirect') return <Navigate to="/auth" replace />
  return children
}
