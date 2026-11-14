import { applyFixedRouteRun, getFixedRouteCounts } from '../../../domain/day-record.ts'
import { removeCallDetail, upsertCallDetail } from '../../../domain/call-details.ts'
import { getDetailPaymentSummary } from '../../../domain/finance.ts'
import { togglePinnedLocation as togglePinnedLocationIn } from '../../../domain/locationShortcuts.ts'
import { addPlatformPreset, removePlatformPreset } from '../../../domain/platformPresets.ts'
import { toggleCallPaymentStatus } from '../../../domain/payments.ts'
import { savePracticeSettings } from '../../../data/sync/settingsSave.ts'
import { useToast } from '../../../shared/hooks/useToast.ts'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import type { CallDetailDraft } from '../../../domain/call-details.ts'
import type { ClientLike, Settings } from '../ui/dayLogTypes.ts'
import type { DayDraft } from './day-log-reducer.ts'
import type { useDayDraft } from './useDayDraft.ts'

type CallDetailActionOptions = {
  dateKey: string
  clients: Array<ClientLike>
  settings: Settings
  editingCallId: string|null
}

export default function useCallDetailActions(draft: DayDraft, dispatch: ReturnType<typeof useDayDraft>['dispatch'], { dateKey, clients, settings, editingCallId }: CallDetailActionOptions) {
  const { ownerKey } = useSession()
  const showToast = useToast()

  function patchDraft(patch: Partial<DayDraft>) { dispatch({ type: 'patchDraft', patch }) }
  function indexOfCall(id: string) { return draft.callDetails.findIndex((item) => item.id === id) }

  function runRoute(routeId: string, delta: number) {
    const nextCounts = applyFixedRouteRun(getFixedRouteCounts(draft), routeId, delta)
    const nextCount = Math.max(0, (Number(draft.fixedCount) || 0) + delta)
    patchDraft({ fixedRouteCounts: nextCounts, fixedCount: nextCount })
  }

  function saveCall(formDraft: CallDetailDraft) {
    const editingIndex = editingCallId ? indexOfCall(editingCallId) : -1
    const result = upsertCallDetail(draft.callDetails, formDraft, editingIndex, dateKey, clients)
    if (result.error) { showToast?.(result.error); return }
    patchDraft({ callDetails: result.items as Array<DayDraft['callDetails'][number]> })
    dispatch({ type: 'closeCallForm' })
    const added = settings.platformOn ? addPlatformPreset(settings, formDraft.platform || '') : null
    showToast?.(added?.error || (editingIndex >= 0 ? '세부 입력을 수정했습니다.' : '세부 입력을 저장했습니다.'))
    if (added && !added.error && added.settings !== settings) void savePlatformPresets((current) => addPlatformPreset(current, formDraft.platform || ''))
  }

  async function savePlatformPresets(change: (current: Settings) => { settings: Settings }) {
    try {
      await savePracticeSettings(ownerKey, (current) => ({ platformPresets: change(current).settings.platformPresets }))
    } catch {
      showToast?.('플랫폼 칩 저장에 실패했습니다.')
    }
  }

  function removePlatform(name: string) {
    void savePlatformPresets((current) => removePlatformPreset(current, name))
  }

  function deleteCall(id: string) {
    patchDraft({ callDetails: removeCallDetail(draft.callDetails, indexOfCall(id)) as Array<DayDraft['callDetails'][number]> })
  }

  async function togglePinnedLocation(location: string) {
    const result = togglePinnedLocationIn(settings, location)
    if (result.error) { showToast?.(result.error); return }
    try {
      await savePracticeSettings(ownerKey, (current) => ({ pinnedLocations: togglePinnedLocationIn(current, location).settings.pinnedLocations }))
    } catch {
      showToast?.('고정 장소 저장에 실패했습니다.')
    }
  }

  function togglePayment(id: string) {
    const detail = draft.callDetails.find((item) => item.id === id)
    if (!detail) return
    const unpaid = getDetailPaymentSummary(detail).status !== 'paid'
    const wrapped = { [dateKey]: { ...draft, callDetails: draft.callDetails } }
    const result = toggleCallPaymentStatus(wrapped, dateKey, id)
    if (result.error) { showToast?.(result.error); return }
    patchDraft({ callDetails: result.data[dateKey].callDetails })
    showToast?.(unpaid ? '수금 처리했습니다.' : '수금을 취소했습니다.')
  }

  return { patchDraft, runRoute, saveCall, deleteCall, togglePayment, togglePinnedLocation, removePlatform }
}
