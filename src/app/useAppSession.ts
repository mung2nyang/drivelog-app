import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { applyTheme, phoneTheme, settingsTheme, watchPhoneTheme } from '../data/sync/settingsSave.ts'
import { endCloudSession } from '../data/cloud/cloudSession.ts'
import { confirmReloadIfUnsaved } from '../data/sync/durableWriteGuard.ts'
import { buzz } from './haptic.ts'
import { isFailureMessage } from '../shared/utils/failureMessages.ts'
import { supabase } from '../data/cloud/supabaseClient.ts'
import { restoreSessionOnBoot } from './boot.ts'
import { ownerKeyFromSession } from '../data/cloud/appSession.ts'
import { initializeOwnerFromPersist } from '../data/store/owner-state.ts'
import { useOwnerCars, useOwnerSettings } from '../data/store/ownerDataHooks.ts'
import { isAlreadyInAppOnBoot } from './bootHomeGuard.ts'
import {
  clearGuestModePersisted,
  GUEST_APP_SESSION,
  isGuestModePersisted,
} from './guestSessionPersist.ts'
import type { AppSession } from '../data/sync/syncTypes.ts'

export function useAppSession() {
  const [session, setSession] = useState<AppSession | null>(null)
  const [toast, setToast] = useState('')
  const [booting, setBooting] = useState(true)
  const [bootLinkFailed, setBootLinkFailed] = useState(false)
  const [loadFailedOwner, setLoadFailedOwner] = useState('')
  const [phoneScheme, setPhoneScheme] = useState(phoneTheme)

  const navigate = useNavigate()
  const location = useLocation()

  const ownerKey = ownerKeyFromSession(session)
  const practiceSettings = useOwnerSettings(ownerKey)
  const cars = useOwnerCars(ownerKey)
  const inAccountFlow = location.pathname.startsWith('/auth') || location.pathname === '/onboarding' || location.pathname === '/welcome'

  function showToast(message: string) {
    setToast(message)
  }

  const navigateRef = useRef(navigate)
  useEffect(() => { navigateRef.current = navigate })

  const goHome = useCallback((nextSession: AppSession | null, message?: string) => {
    setSession(nextSession)
    navigateRef.current('/app', { replace: true })
    if (message) setToast(message)
  }, [])

  const homePathRef = useRef(location.pathname)
  useEffect(() => { homePathRef.current = location.pathname })

  useEffect(() => {
    let cancelled = false
    restoreSessionOnBoot().then((restored) => {
      if (cancelled) return
      if (restored && 'linkCheckFailed' in restored) {
        setBootLinkFailed(true)
      } else if (restored) {
        clearGuestModePersisted()
        const message = restored.hydrateError ? '로그인은 됐지만 기록 일부를 불러오지 못했습니다.' : undefined
        if (restored.needsProfile) {
          setSession(restored.session)
          navigateRef.current('/welcome', { replace: true })
        } else if (isAlreadyInAppOnBoot(homePathRef.current)) {
          setSession(restored.session)
          if (message) setToast(message)
        } else {
          goHome(restored.session, message)
        }
      } else if (isGuestModePersisted()) {
        const guestSession = GUEST_APP_SESSION
        if (isAlreadyInAppOnBoot(homePathRef.current)) {
          setSession(guestSession)
        } else {
          goHome(guestSession)
        }
      }
      setBooting(false)
    })
    return () => { cancelled = true }
  }, [goHome])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setLoadFailedOwner(initializeOwnerFromPersist(ownerKey) ? '' : ownerKey)
  }, [ownerKey])

  useEffect(() => watchPhoneTheme(setPhoneScheme), [])

  const { theme, themeFollowPhone } = practiceSettings
  useEffect(() => {
    if (booting) return
    applyTheme(!session || inAccountFlow ? phoneScheme : settingsTheme({ theme, themeFollowPhone }, phoneScheme))
  }, [booting, session, inAccountFlow, theme, themeFollowPhone, phoneScheme, location.pathname])

  useEffect(() => {
    if (!toast) return undefined
    buzz()
    const timer = setTimeout(() => setToast(''), isFailureMessage(toast) ? 6000 : 4000)
    return () => clearTimeout(timer)
  }, [toast])

  async function handleLogout({ signOut = false } = {}) {
    if (!confirmReloadIfUnsaved()) return
    if (signOut) {
      try { await supabase.auth.signOut() } catch { }
    }
    endCloudSession()
    clearGuestModePersisted()
    setSession(null)
    navigate('/auth', { replace: true })
  }

  return {
    session,
    setSession,
    toast,
    showToast,
    booting,
    bootLinkFailed,
    guestLoadFailed: !!session?.guestMode && loadFailedOwner === ownerKey,
    ownerKey,
    cars,
    goHome,
    handleLogout,
  }
}
