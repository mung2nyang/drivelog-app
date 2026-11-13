import { Navigate, Route, Routes, useSearchParams, type NavigateOptions, type To } from 'react-router-dom'
import HomePage from '../../features/home/ui/HomePage.jsx'
import ComingSoonRoute from './ComingSoonRoute.tsx'
import MainPageRoute from './MainPageRoute.tsx'
import {
  AppSettingsPage,
  CarManagementPage,
  ClientManagementPage,
  DriverConnectionPage,
  LinkedDriverClientsPage,
  LinkedDriverManagementPage,
  MaintFuelPage,
  MyPage,
  OwnerScopedClientsView,
  PersonalInfoPage,
  ReceivablesPage,
  DocumentIssuePage,
  RevenuePage,
  CustomerCenterPage,
  AdminInquiriesPage,
  NoticePage,
  MessageSettingsPage,
  NotificationsPage,
} from './lazyPages.ts'
import { useSession } from '../../data/cloud/sessionContext.ts'
import type { AppSession } from '../../data/sync/syncTypes.ts'

type AppShellRoutesProps = {
  notifCount: number
  onOpenMenu: () => void
  onOpenNotifs: () => void
  onBackToAuth?: () => void
  onGoAuth?: () => void
  onSessionUpdate?: (session: AppSession) => void
  navigate: (to: To | number, options?: NavigateOptions) => void
  goBack: (target: string) => void
  goToPage: (page: string, title?: string, backFallback?: string) => void
}

export default function AppShellRoutes({
  notifCount,
  onOpenMenu, onOpenNotifs, onBackToAuth, onGoAuth, onSessionUpdate, navigate, goBack, goToPage,
}: AppShellRoutesProps) {
  const { session } = useSession()
  const [params] = useSearchParams()
  const backTarget = params.get('back') === 'mypage' ? '/app/me' : '/app'

  function mainPage() {
    return (
      <MainPageRoute
        userName={session?.name}
        onOpenMenu={onOpenMenu}
        onBackToAuth={onBackToAuth}
      />
    )
  }
  return (
    <Routes>
      <Route index element={<HomePage notifCount={notifCount} onOpenMenu={onOpenMenu} onOpenNotifs={onOpenNotifs} onOpenToday={(dateKey: string) => navigate(`/app/day/${dateKey}`, { state: { from: 'home' } })} onOpenReceivables={() => goToPage('receivables', undefined, 'home')} onOpenCalendar={() => navigate('/app/calendar')} />} />
      <Route path="calendar" element={mainPage()} />
      <Route path="day/:date" element={mainPage()} />
      <Route path="logs/:logId/manage" element={<LinkedDriverManagementPage onBack={() => navigate(-1)} onOpenMenu={onOpenMenu} />} />
      <Route path="logs/:logId/clients" element={<LinkedDriverClientsPage onBack={() => navigate(-1)} onOpenMenu={onOpenMenu} />} />
      <Route path="logs/:logId/expenses" element={<MaintFuelPage onBack={() => navigate(-1)} onOpenMenu={onOpenMenu} />} />
      <Route path="logs/:logId/report" element={<DocumentIssuePage isEmployedDriver={session?.accountType === 'employed_driver'} onBack={() => navigate(-1)} onOpenMenu={onOpenMenu} />} />
      <Route path="logs/:logId/settings" element={<AppSettingsPage onBack={() => navigate(-1)} onOpenMenu={onOpenMenu} />} />
      <Route path="logs/:logId/day/:date" element={mainPage()} />
      <Route path="logs/:logId" element={mainPage()} />
      <Route path="cars" element={<CarManagementPage onBack={() => goBack(backTarget)} onOpenMenu={onOpenMenu} />} />
      <Route
        path="clients"
        element={
          session?.linkedOwnerId ? (
            <OwnerScopedClientsView onBack={() => goBack(backTarget)} onOpenMenu={onOpenMenu} />
          ) : (
            <ClientManagementPage onBack={() => goBack(backTarget)} onOpenMenu={onOpenMenu} />
          )
        }
      />
      <Route path="me" element={<MyPage onLinked={(next: AppSession) => { onSessionUpdate?.(next); navigate('/app') }} onOpen={(page: string, title: string | undefined) => goToPage(page, title, 'mypage')} onOpenMenu={onOpenMenu} />} />
      <Route path="me/profile" element={<PersonalInfoPage onBack={() => goBack(backTarget)} onGoAuth={onGoAuth} onOpenMenu={onOpenMenu} onUnlinked={(next: AppSession) => { onSessionUpdate?.(next); goBack('/app') }} />} />
      <Route path="me/settings" element={<AppSettingsPage onBack={() => goBack(backTarget)} onOpenMenu={onOpenMenu} />} />
      <Route path="expenses" element={<MaintFuelPage onBack={() => goBack(backTarget)} onOpenMenu={onOpenMenu} />} />
      <Route path="receivables/*" element={<ReceivablesPage isEmployedDriver={session?.accountType === 'employed_driver'} onBack={() => goBack(backTarget)} onOpenMenu={onOpenMenu} />} />
      <Route path="report" element={<DocumentIssuePage isEmployedDriver={session?.accountType === 'employed_driver'} onBack={() => goBack(backTarget)} onOpenMenu={onOpenMenu} />} />
      <Route path="tax" element={<Navigate to="/app/report" replace />} />
      <Route path="drivers/:linkId/clients" element={<LinkedDriverClientsPage onBack={() => navigate(-1)} onOpenMenu={onOpenMenu} />} />
      <Route path="drivers/:linkId" element={<LinkedDriverManagementPage onBack={() => navigate(-1)} onOpenMenu={onOpenMenu} />} />
      <Route path="drivers" element={<DriverConnectionPage navigate={navigate} onBack={() => goBack('/app/me')} />} />
      <Route path="revenue" element={<RevenuePage onOpenMenu={onOpenMenu} />} />
      <Route path="support" element={<CustomerCenterPage onGoAuth={onGoAuth} onBack={() => goBack(backTarget)} onOpenMenu={onOpenMenu} initialTab={params.get('tab') === 'my' ? 'myInquiries' : 'faq'} />} />
      <Route path="admin/inquiries" element={<AdminInquiriesPage onBack={() => goBack(backTarget)} onOpenMenu={onOpenMenu} />} />
      <Route path="notice" element={<NoticePage onBack={() => goBack(backTarget)} onOpenMenu={onOpenMenu} />} />
      <Route path="message-settings" element={<MessageSettingsPage onBack={() => goBack(backTarget)} />} />
      <Route path="notifications" element={<NotificationsPage onBack={() => navigate(-1)} onOpenMenu={onOpenMenu} onOpenPage={(page: string) => goToPage(page)} />} />
      <Route path="soon" element={<ComingSoonRoute />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
