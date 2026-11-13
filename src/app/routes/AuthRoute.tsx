import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthPage from '../../features/account/ui/AuthPage.jsx'
import LoadingScreen from '../shell/LoadingScreen.tsx'
import { useSession } from '../../data/cloud/sessionContext.ts'

export const AUTH_WITH_SESSION_REDIRECT_MS = 1500

export default function AuthRoute({ booting, onGuest }: { booting: boolean, onGuest?: () => void }) {
  const { session } = useSession()
  const navigate = useNavigate()
  const signedIn = !booting && !!session

  useEffect(() => {
    if (!signedIn) return undefined
    const timer = setTimeout(() => navigate('/app', { replace: true }), AUTH_WITH_SESSION_REDIRECT_MS)
    return () => clearTimeout(timer)
  }, [signedIn, navigate])

  if (booting || session) return <LoadingScreen />

  return (
    <div className="container account-flow-container">
      <AuthPage onGuest={onGuest} />
    </div>
  )
}
