import { Suspense, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, type NavigateOptions, type To } from 'react-router-dom'
import BottomNav from './BottomNav.tsx'
import { PageSkeleton } from '../../shared/ui/Skeleton.tsx'
import SideMenu, { preloadSideMenuBanner } from './SideMenu.tsx'
import PullRefreshIndicator from './PullRefreshIndicator.tsx'
import useNotifications from '../../features/notifications/hooks/useNotifications.js'
import { confirmLeaveIfUnsafe } from '../../data/sync/durableWriteGuard.ts'
import { useOwnerCars, useOwnerDrivers } from '../../data/store/ownerDataHooks.ts'
import PageLoadErrorBoundary from './PageLoadErrorBoundary.tsx'
import HydrationRetryBanner from './HydrationRetryBanner.tsx'
import OfflineBanner from './OfflineBanner.tsx'
import { ConfirmDialogHost } from '../../shared/ui/confirmDialog.tsx'
import StudioCredit from '../../shared/ui/StudioCredit.tsx'
import AppShellRoutes from '../routes/AppShellRoutes.tsx'
import useBackToExit from './useBackToExit.ts'
import usePageTransition from './usePageTransition.ts'
import { withFromLogState } from './fromLogNavigation.ts'
import { chooseMove, historyIdx, markRewind, popPanelGuardThen } from '../../shared/utils/historyMoves.ts'
import { buildSubLogMenuItems } from './subLogMenuItems.ts'
import { useSession } from '../../data/cloud/sessionContext.ts'
import { useIsAdmin } from '../../data/cloud/adminRole.ts'
import { UnbiseoProvider } from '../../features/home/hooks/unbiseoContext.ts'
import UnbiseoDock from '../../features/home/ui/UnbiseoDock.tsx'
import { assistantNavTarget } from '../routes/assistantCallState.ts'
import type { AppSession } from '../../data/sync/syncTypes.ts'

const PAGE_PATH: Record<string, string> = {
  home: '',
  cars: 'cars',
  clients: 'clients',
  expenses: 'expenses',
  receivables: 'receivables',
  report: 'report',
  invoices: 'report',
  drivers: 'drivers',
  revenue: 'revenue',
  profile: 'me/profile',
  settings: 'me/settings',
  mypage: 'me',
  admin: 'admin/inquiries',
  'my-inquiries': 'support?tab=my',
}

function pagePath(page: string) {
  const segment = PAGE_PATH[page] ?? page
  return segment ? `/app/${segment}` : '/app'
}

export default function AppShell({ onBackToAuth, onGoAuth, onSessionUpdate }: {
  onBackToAuth?: () => void
  onGoAuth?: () => void
  onSessionUpdate?: (session: AppSession) => void
}) {
  const { ownerKey, session } = useSession()
  const location = useLocation()
  const rawNavigate = useNavigate()
  function navigate(to: To | number, options?: NavigateOptions) {
    if (!confirmLeaveIfUnsafe()) return
    if (typeof to === 'number') { rawNavigate(to); return }
    popPanelGuardThen(() => rawNavigate(to, withFromLogState(location.pathname, to, options)))
  }
  function moveTo(to: string) {
    popPanelGuardThen(() => moveNow(to))
  }
  function moveNow(to: string) {
    const move = chooseMove({ from: location.pathname, to: to.split('?')[0], idx: historyIdx() })
    if (move.kind !== 'rewind') { navigate(to, move.kind === 'replace' ? { replace: true } : undefined); return }
    if (!confirmLeaveIfUnsafe()) return
    markRewind()
    rawNavigate(-move.steps)
  }
  function goBack(target: string) {
    const state = location.state
    const fromMyPage = state && typeof state === 'object' && Reflect.get(state, 'openedFrom') === 'mypage'
    if (target === '/app/me' && fromMyPage) navigate(-1)
    else moveTo(target)
  }
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => { preloadSideMenuBanner() }, [])
  useBackToExit()
  const pageBoxRef = usePageTransition()
  const drivers = useOwnerDrivers(ownerKey)
  const cars = useOwnerCars(ownerKey)
  const isOwnerSession = !session?.linkedOwnerId
  const isAdmin = useIsAdmin() === 'admin'
  const subLogItems = useMemo(
    () => buildSubLogMenuItems(cars, drivers, isOwnerSession),
    [cars, drivers, isOwnerSession],
  )
  const linkedDriverItems = useMemo(() => {
    if (!isOwnerSession) return []
    return drivers
      .filter((driver) => driver.status === 'linked')
      .map((driver) => ({
        linkId: driver.id,
        driverName: driver.name || '기사',
      }))
  }, [drivers, isOwnerSession])

  const notifications = useNotifications(ownerKey, null, location.pathname)

  const activeNav = location.pathname === '/app' || location.pathname === '/app/notifications'
    || (location.pathname.startsWith('/app/logs/') && !location.pathname.includes('/day/'))
    ? 'home'
    : location.pathname === '/app/calendar' || location.pathname.startsWith('/app/day/')
      || (location.pathname.startsWith('/app/logs/') && location.pathname.includes('/day/'))
      ? 'work'
      : location.pathname === '/app/revenue'
        ? 'revenue'
        : 'mypage'

  function goToPage(page: string, title?: string, backFallback?: string) {
    if (page === 'soon') {
      const query = new URLSearchParams({ title: title || '', back: backFallback || '' })
      navigate(`/app/soon?${query.toString()}`)
      return
    }
    const opened = backFallback === 'mypage' ? { state: { openedFrom: 'mypage' } } : undefined
    navigate(backFallback ? `${pagePath(page)}?back=${backFallback}` : pagePath(page), opened)
  }

  function selectTab(tab: string) {
    setMenuOpen(false)
    if (tab === 'work') {
      moveTo('/app/calendar')
      return
    }
    if (tab === 'revenue') {
      moveTo('/app/revenue')
      return
    }
    moveTo(tab === 'home' ? '/app' : '/app/me')
  }

  return (
    <UnbiseoProvider onOpenCall={(record, options) => navigate(...assistantNavTarget(record, options))}>
    <div className="container main-app-container">
      <OfflineBanner />
      <HydrationRetryBanner />
      <div ref={pageBoxRef} className="page-transition">
        <PageLoadErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<PageSkeleton path={location.pathname} onOpenMenu={() => setMenuOpen(true)} />}>
          <AppShellRoutes
            notifCount={notifications.length}
            onOpenMenu={() => setMenuOpen(true)}
            onOpenNotifs={() => navigate('/app/notifications')}
            onBackToAuth={onBackToAuth}
            onGoAuth={onGoAuth}
            onSessionUpdate={onSessionUpdate}
            navigate={navigate}
            goBack={goBack}
            goToPage={goToPage}
          />
        </Suspense>
        </PageLoadErrorBoundary>
      </div>
      <StudioCredit />
      {location.pathname !== '/app' && <UnbiseoDock />}
      <BottomNav active={activeNav} onSelect={selectTab} />
      <PullRefreshIndicator />
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSelect={(page: string, title: string | undefined) => goToPage(page, title, 'home')}
        linkedDriverItems={linkedDriverItems}
        onOpenLinkedDriver={(linkId: string) => {
          navigate(`/app/drivers/${encodeURIComponent(linkId)}`)
        }}
        subLogItems={subLogItems}
        isAdmin={isAdmin}
        onOpenSubLog={(vehicleNumber: string) => {
          navigate(`/app/logs/${encodeURIComponent(vehicleNumber)}/manage`)
        }}
      />
      <ConfirmDialogHost />
    </div>
    </UnbiseoProvider>
  )
}
