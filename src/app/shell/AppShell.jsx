// @ts-check
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BottomNav from './BottomNav.jsx'
import { PageSkeleton } from '../../shared/ui/Skeleton.tsx'
import SideMenu, { preloadSideMenuBanner } from './SideMenu.jsx'
import PullRefreshIndicator from './PullRefreshIndicator.jsx'
import useNotifications from '../../features/notifications/hooks/useNotifications.js'
import { confirmLeaveIfUnsafe } from '../../data/sync/durableWriteGuard.ts'
import { useOwnerCars, useOwnerDrivers } from '../../data/store/ownerDataHooks.ts'
import PageLoadErrorBoundary from './PageLoadErrorBoundary.jsx'
import HydrationRetryBanner from './HydrationRetryBanner.jsx'
import OfflineBanner from './OfflineBanner.jsx'
import { ConfirmDialogHost } from '../../shared/ui/confirmDialog.tsx'
import StudioCredit from '../../shared/ui/StudioCredit.tsx'
import AppShellRoutes from '../routes/AppShellRoutes.jsx'
import useBackToExit from './useBackToExit.js'
import usePageTransition from './usePageTransition.js'
import { withFromLogState } from './fromLogNavigation.js'
import { chooseMove, historyIdx, markRewind, popPanelGuardThen } from '../../shared/utils/historyMoves.ts'
import { buildSubLogMenuItems } from './subLogMenuItems.js'
import { useSession } from '../../data/cloud/sessionContext.ts'
import { useIsAdmin } from '../../data/cloud/adminRole.ts'
import { UnbiseoProvider } from '../../features/home/hooks/unbiseoContext.ts'
import UnbiseoDock from '../../features/home/ui/UnbiseoDock.tsx'
import { assistantNavTarget } from '../routes/assistantCallState.js'

/** @typedef {import('../../data/sync/syncTypes.ts').AppSession} AppSession */

/** @type {Record<string, string>} */
const PAGE_PATH = {
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

/** @param {string} page */
function pagePath(page) {
  const segment = PAGE_PATH[page] ?? page
  return segment ? `/app/${segment}` : '/app'
}

/**
 * @param {Object} props
 * @param {() => void} [props.onBackToAuth]
 * @param {() => void} [props.onGoAuth]
 * @param {(session: AppSession) => void} [props.onSessionUpdate]
 */
export default function AppShell({ onBackToAuth, onGoAuth, onSessionUpdate }) {
  const { ownerKey, session } = useSession()
  const location = useLocation()
  const rawNavigate = useNavigate()
  /**
   * @param {import('react-router-dom').To | number} to
   * @param {import('react-router-dom').NavigateOptions} [options]
   */
  function navigate(to, options) {
    if (!confirmLeaveIfUnsafe()) return
    if (typeof to === 'number') { rawNavigate(to); return }
    popPanelGuardThen(() => rawNavigate(to, withFromLogState(location.pathname, to, options)))
  }
  /** 아래 메뉴·← 이동: 홈은 처음 기록으로 되감고, 그 밖엔 홈에서만 쌓고 나머진 교체. @param {string} to */
  function moveTo(to) {
    popPanelGuardThen(() => moveNow(to))
  }
  /** @param {string} to */
  function moveNow(to) {
    const move = chooseMove({ from: location.pathname, to: to.split('?')[0], idx: historyIdx() })
    if (move.kind !== 'rewind') { navigate(to, move.kind === 'replace' ? { replace: true } : undefined); return }
    if (!confirmLeaveIfUnsafe()) return
    markRewind()
    rawNavigate(-move.steps)
  }
  /** 화면 위 ← : 마이페이지에서 연 화면이면 한 장 돌아가고, 아니면 moveTo. @param {string} target */
  function goBack(target) {
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

  /** @param {string} page @param {string} [title] @param {string} [backFallback] */
  function goToPage(page, title, backFallback) {
    if (page === 'soon') {
      const query = new URLSearchParams({ title: title || '', back: backFallback || '' })
      navigate(`/app/soon?${query.toString()}`)
      return
    }
    const opened = backFallback === 'mypage' ? { state: { openedFrom: 'mypage' } } : undefined
    navigate(backFallback ? `${pagePath(page)}?back=${backFallback}` : pagePath(page), opened)
  }

  /** @param {string} tab */
  function selectTab(tab) {
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
        onSelect={(/** @type {string} */ page, /** @type {string|undefined} */ title) => goToPage(page, title, 'home')}
        linkedDriverItems={linkedDriverItems}
        onOpenLinkedDriver={(/** @type {string} */ linkId) => {
          navigate(`/app/drivers/${encodeURIComponent(linkId)}`)
        }}
        subLogItems={subLogItems}
        isAdmin={isAdmin}
        onOpenSubLog={(/** @type {string} */ vehicleNumber) => {
          navigate(`/app/logs/${encodeURIComponent(vehicleNumber)}/manage`)
        }}
      />
      <ConfirmDialogHost />
    </div>
    </UnbiseoProvider>
  )
}
