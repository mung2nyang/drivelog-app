// @ts-check
import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import CalendarPage from '../../features/calendar/ui/CalendarPage.jsx'
import DayLogPage from '../../features/day-log/ui/DayLogPage.jsx'
import { resolveLogSettings } from '../../domain/carSettingsScope.ts'
import { parseDateKeySelection } from '../../domain/calendar.ts'
import { useOwnerCars, useOwnerClients, useOwnerSettings } from '../../data/store/ownerDataHooks.ts'
import { confirmLeaveIfUnsafe } from '../../data/sync/durableWriteGuard.ts'
import { resolveWorkLogCloseTarget } from './workLogNavigation.js'
import { readAssistantCall, readAssistantDayOff, readAssistantExpense, readAssistantFixed } from './assistantCallState.js'
import { useSession } from '../../data/cloud/sessionContext.ts'

/** @typedef {import('../../data/sync/syncTypes.ts').AppSession} AppSession */

/**
 * @param {Object} props
 * @param {string} [props.userName]
 * @param {(() => void)} [props.onOpenMenu]
 * @param {(() => void)} [props.onBackToAuth]
 */
export default function MainPageRoute({
  userName,
  
  onOpenMenu,
  onBackToAuth,
}) {
  const { ownerKey, session } = useSession()
  const { date, logId: rawLogId } = useParams()
  const logId = rawLogId ? decodeURIComponent(rawLogId) : 'main'
  const navigate = useNavigate()
  const location = useLocation()
  const selected = parseDateKeySelection(date)
  const ownerSettings = useOwnerSettings(ownerKey)
  const settings = useMemo(() => resolveLogSettings(ownerSettings, logId), [ownerSettings, logId])
  const clients = useOwnerClients(ownerKey)
  const cars = useOwnerCars(ownerKey)
  const clientScopeKey = session?.linkedOwnerId
    ? (cars[0]?.number || 'main')
    : logId
  const knownLog = logId === 'main' || cars.some((car) => car.number === logId)
  const assistantCall = readAssistantCall(location.state)
  const assistantExpense = readAssistantExpense(location.state)
  const assistantFixed = readAssistantFixed(location.state)
  const assistantDayOff = readAssistantDayOff(location.state)

  useEffect(() => {
    if (!readAssistantCall(location.state) && !readAssistantExpense(location.state) && !readAssistantFixed(location.state) && !readAssistantDayOff(location.state)) return
    navigate(`${location.pathname}${location.search}`, { replace: true, state: { from: location.state?.from } })
  }, [location, navigate])

  useEffect(() => {
    if (date && !selected) navigate('/app/calendar', { replace: true })
  }, [date, selected, navigate])

  useEffect(() => {
    if (rawLogId && !knownLog) navigate('/app/calendar', { replace: true })
  }, [rawLogId, knownLog, navigate])

  function closeWorkLog() {
    const target = resolveWorkLogCloseTarget(location.state, logId, selected?.dateKey)
    if (target.mode === 'back') navigate(-1)
    else navigate(target.to, { replace: true })
  }

  if (selected) {
    if (rawLogId && !knownLog) return null
    return (
      <DayLogPage
        key={`${ownerKey}:${logId}:${selected.dateKey}`}
        month={selected.month}
        day={selected.day}
        dateKey={selected.dateKey}
        logId={logId}
        clientScopeKey={clientScopeKey}
        clients={clients}
        settings={settings}
        onClose={closeWorkLog}
        onOpenMenu={onOpenMenu}
        isEmployedDriver={session?.accountType === 'employed_driver'}
        assistantCall={assistantCall}
        assistantExpense={assistantExpense}
        assistantFixed={assistantFixed}
        assistantDayOff={assistantDayOff}
        assistantCallKey={location.key}
      />
    )
  }

  return (
    <CalendarPage
      logId={logId}
      clientScopeKey={clientScopeKey}
      userName={userName}
      onOpenMenu={onOpenMenu}
      onBackToAuth={onBackToAuth}
      onSelectDay={(sel) => {
        if (!confirmLeaveIfUnsafe()) return
        const path = logId === 'main'
          ? `/app/day/${sel.dateKey}`
          : `/app/logs/${encodeURIComponent(logId)}/day/${sel.dateKey}`
        navigate(path, { state: { from: 'calendar' } })
      }}
    />
  )
}
