import { useMemo, useState } from 'react'
import { expensesForVehicleDay } from '../../../domain/calendarBadges.ts'
import { getFixedRouteClient } from '../../../domain/clients.ts'
import { assignmentPeriodNotice } from '../../../domain/drivers.ts'
import { locationShortcutList } from '../../../domain/locationShortcuts.ts'
import { confirmLeaveIfUnsafe } from '../../../data/sync/durableWriteGuard.ts'
import { useOwnerDrivers, useOwnerWorkData, useOwnerWorkDataByLogId } from '../../../data/store/ownerDataHooks.ts'
import { useDayDraft } from '../hooks/useDayDraft.ts'
import { dayOffPatch } from '../hooks/day-log-reducer.ts'
import { useExpenseForm } from '../hooks/useExpenseForm.ts'
import useCallDetailActions from '../hooks/useCallDetailActions.ts'
import { bindInlinePanelActions } from './inlinePanelActions.ts'
import usePanelBackGuard from '../hooks/usePanelBackGuard.ts'
import useAssistantPrefill from '../hooks/useAssistantPrefill.ts'
import useAssistantExpense from '../hooks/useAssistantExpense.ts'
import useAssistantFixed from '../hooks/useAssistantFixed.ts'
import useAssistantDayOff from '../hooks/useAssistantDayOff.ts'
import { popPanelGuardThen } from '../../../shared/utils/historyMoves.ts'
import AutoSaveStatus from './AutoSaveStatus.tsx'
import DayFareTotal from './DayFareTotal.tsx'
import OffToggle from './OffToggle.tsx'
import FixedCountSection from './FixedCountSection.tsx'
import FixedRouteChips from './FixedRouteChips.tsx'
import PalletSection from './PalletSection.tsx'
import CallDetailList from './CallDetailList.tsx'
import CallDetailForm from './CallDetailForm.tsx'
import DayLogExpenses from './DayLogExpenses.tsx'
import DailyInspectionNotice from './DailyInspectionNotice.tsx'
import AssignmentPeriodPage from './AssignmentPeriodPage.tsx'
import MessageTemplateSheet from './MessageTemplateSheet.tsx'
import InlineSheet from './InlineSheet.tsx'
import PageHeader from '../../../shared/ui/PageHeader.tsx'
import './day-log-shell.css'
import './fixed-route.css'
import './day-log.css'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import type { AssistantDayOff } from '../hooks/useAssistantDayOff.ts'
import type { AssistantExpense } from '../hooks/useAssistantExpense.ts'
import type { AssistantFixed } from '../hooks/useAssistantFixed.ts'
import type { ClientLike, Settings } from './dayLogTypes.ts'

const EMPTY_WORK: Record<string, never> = {}
const EMPTY_PINS: Array<never> = []

type DayLogPageProps = {
  month: number
  day: number
  dateKey: string
  clients: Array<ClientLike>
  settings: Settings
  onClose?: () => void
  onOpenMenu?: (() => void)
  logId?: string
  clientScopeKey?: string
  isEmployedDriver?: boolean
  assistantCall?: { loadLoc: string, unloadLoc: string, fare: number|null, client: string, cancelOff: boolean }|null
  assistantExpense?: AssistantExpense|null
  assistantFixed?: AssistantFixed|null
  assistantDayOff?: AssistantDayOff|null
  assistantCallKey?: string
}

export default function DayLogPage({ month, day, dateKey, clients, settings, onClose, onOpenMenu, logId = 'main', clientScopeKey, isEmployedDriver = false, assistantCall = null, assistantExpense = null, assistantFixed = null, assistantDayOff = null, assistantCallKey }: DayLogPageProps) {
  const { ownerKey } = useSession()
  const { draft, editingCallId, callFormOpen, dispatch, autoSaveStatus } = useDayDraft(ownerKey, dateKey, logId)
  const expenseForm = useExpenseForm(ownerKey, dateKey, logId)
  const { patchDraft, runRoute, saveCall, deleteCall, togglePayment, togglePinnedLocation, removePlatform } = useCallDetailActions(draft, dispatch, { dateKey, clients, settings, editingCallId })
  const [messageCallId, setMessageCallId] = useState<string|null>(null)
  const mainWorkData = useOwnerWorkData(ownerKey)
  const workDataByLogId = useOwnerWorkDataByLogId(ownerKey)
  const workData = logId === 'main' ? mainWorkData : (workDataByLogId[logId] || EMPTY_WORK)
  const myLink = useOwnerDrivers(ownerKey).find((driver) => driver.status === 'linked')
  const periodNotice = isEmployedDriver ? assignmentPeriodNotice(dateKey, myLink?.startDate, myLink?.endDate) : null
  const pinnedLocations = settings.pinnedLocations || EMPTY_PINS
  const locationShortcuts = useMemo(
    () => locationShortcutList(workData, draft.callDetails, pinnedLocations),
    [workData, draft.callDetails, pinnedLocations],
  )

  const dayExpenses = expensesForVehicleDay(expenseForm.expenses, dateKey, logId !== 'main' ? logId : undefined)
  const routePresets = settings.fixedRouteOn ? (settings.fixedRoutePresets || []) : []
  const quickCounts = settings.runCountToggle ? (settings.runCountPresets || []) : []
  const fixedRouteClient = getFixedRouteClient({ clients }, clientScopeKey || logId)
  const palletVisible = !!(settings.fixedOn && fixedRouteClient?.palletOn)
  const showCallDetailList = settings.callDetail || draft.callDetails.length > 0
  const editingCallItem = editingCallId ? draft.callDetails.find((item) => item.id === editingCallId) || null : null
  const previousCallItem = draft.callDetails.length > 0 ? draft.callDetails[draft.callDetails.length - 1] : null
  const messageItem = messageCallId ? draft.callDetails.find((item) => item.id === messageCallId) : null

  async function handleClose() {
    if (confirmLeaveIfUnsafe() && await confirmLeaveOpenPanel()) popPanelGuardThen(() => onClose?.())
  }

  const { openCallForm, openExpenseAdd, openExpenseEdit, openExpenseKindPick, confirmLeaveOpenPanel } = bindInlinePanelActions(dispatch, expenseForm, { callFormOpen, editingCallId })
  const { prefill, formKey } = useAssistantPrefill({ assistantCall, assistantCallKey, callDetailOn: !!settings.callDetail, draft, callFormOpen, editingCallId, dispatch, closeExpense: expenseForm.closeAll, confirmLeaveOpenPanel })
  useAssistantExpense({ assistantExpense, assistantCallKey, draft, dispatch, openAdd: expenseForm.openAdd, confirmLeaveOpenPanel })
  useAssistantFixed({ assistantFixed, assistantCallKey, fixedOn: !!settings.fixedOn, routePresets, draft, patchDraft, runRoute })
  useAssistantDayOff({ assistantDayOff, assistantCallKey, draft, patchDraft, month, day })
  usePanelBackGuard(callFormOpen || expenseForm.modalOpen, confirmLeaveOpenPanel, () => { expenseForm.closeAll(); dispatch({ type: 'closeCallForm' }); onClose?.() })

  if (periodNotice) return <AssignmentPeriodPage title={`${month}월 ${day}일 운행일지`} notice={periodNotice} onBack={onClose ? handleClose : undefined} onOpenMenu={onOpenMenu} />
  return (
    <div className={`page work-log-page${workData[dateKey]?.assignedVehicleNumber ? ' has-assigned-vehicle' : ''}`}>
      <PageHeader
        title={<>{`${month}월 ${day}일 운행일지`}{workData[dateKey]?.assignedVehicleNumber ? <span className="assigned-vehicle-tag">배정 차량 {workData[dateKey].assignedVehicleNumber}</span> : null}</>}
        titleExtra={<><AutoSaveStatus status={autoSaveStatus} /><DayFareTotal draft={draft} fixedRouteClient={fixedRouteClient} palletOn={palletVisible} /></>}
        onBack={onClose ? handleClose : undefined}
        onOpenMenu={onOpenMenu}
      />
      <OffToggle isOff={draft.isOff} callCount={draft.callDetails.length} onChange={(off) => patchDraft(dayOffPatch(off))} />
      <div className={`modal-work-details${draft.isOff ? ' is-off' : ''}`}>
        {settings.fixedOn && (
          <div className="modal-section fixed-route-section">
            <div className="modal-section-title">고정 노선</div>
            <div className="form-group fixed-route-group">
              <FixedCountSection count={draft.fixedCount} isOff={draft.isOff} quickCounts={quickCounts} fixedRouteClient={fixedRouteClient} onChange={(count) => patchDraft({ fixedCount: Math.max(0, parseInt(String(count), 10) || 0) })} />
              <FixedRouteChips routePresets={routePresets} routeCounts={draft.fixedRouteCounts} isOff={draft.isOff} onRun={runRoute} />
            </div>
            <PalletSection visible={palletVisible} palletCount={draft.palletCount} isOff={draft.isOff} fixedRouteClient={fixedRouteClient} onChange={(count) => patchDraft({ palletCount: Math.max(0, parseInt(String(count), 10) || 0) })} />
          </div>
        )}
        <DailyInspectionNotice logId={logId} dateKey={dateKey} month={month} day={day} enabled={!!settings.dailyInspectionOn} isOff={draft.isOff} />

        {showCallDetailList && (
          <CallDetailList
            details={draft.callDetails}
            settings={settings}
            clients={clients}
            canAdd={settings.callDetail}
            onEdit={(id) => openCallForm(id)}
            onDelete={deleteCall}
            onTogglePayment={togglePayment}
            onMessage={(id) => setMessageCallId(id)}
            onAdd={() => openCallForm(null)}
          >
            {settings.callDetail && (
              <InlineSheet
                open={callFormOpen}
                forceInstant={expenseForm.kindPick || expenseForm.modalOpen}
                className="call-detail-inline-host" scrollKey={editingCallId ?? 'new'}
              >
                <CallDetailForm
                  key={editingCallId ?? formKey}
                  value={editingCallItem}
                  previousItem={editingCallId ? null : previousCallItem}
                  prefill={prefill}
                  dateKey={dateKey}
                  clients={clients}
                  settings={settings}
                  logId={logId}
                  clientScopeKey={clientScopeKey}
                  locationShortcuts={locationShortcuts}
                  pinnedLocations={pinnedLocations}
                  onTogglePinnedLocation={togglePinnedLocation}
                  onRemovePlatform={removePlatform}
                  isEmployedDriver={isEmployedDriver}
                  onSave={saveCall}
                  onClose={() => dispatch({ type: 'closeCallForm' })}
                />
              </InlineSheet>
            )}
          </CallDetailList>
        )}

        <DayLogExpenses
          dayExpenses={dayExpenses}
          expenseForm={expenseForm}
          callFormOpen={callFormOpen}
          onKindPick={openExpenseKindPick}
          onAdd={openExpenseAdd}
          onEdit={openExpenseEdit}
        />
      </div>
      {messageItem && (
        <MessageTemplateSheet
          item={messageItem}
          client={clients.find((item) => item.companyName === messageItem.client)}
          onClose={() => setMessageCallId(null)}
        />
      )}
    </div>
  )
}
