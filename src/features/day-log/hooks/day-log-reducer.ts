import { getCallDetails } from '../../../domain/day-record.ts'
import type { CallDetailLike as DomainCallDetailLike } from '../../../domain/callDetail.ts'
import type { CallDetailLike } from '../ui/dayLogTypes.ts'

export type DayDraft = {
  isOff: boolean
  fixedCount: number
  palletCount: number
  callDetails: Array<CallDetailLike>
  fixedRouteCounts: Record<string, number>
}

export type DayLogState = {
  draft: DayDraft
  editingCallId: string|null
  callFormOpen: boolean
}

type DayRecordInput = {
  isOff?: boolean
  fixedCount?: number|string
  palletCount?: number|string
  callDetails?: Array<DomainCallDetailLike>
  fixedRouteCounts?: Record<string, number>
}

export function initDayLogState(record?: DayRecordInput): DayLogState {
  const off = !!record?.isOff
  return {
    draft: {
      isOff: off,
      fixedCount: off ? 0 : Math.max(0, parseInt(String(record?.fixedCount ?? 0), 10) || 0),
      palletCount: off ? 0 : Math.max(0, parseInt(String(record?.palletCount ?? 0), 10) || 0),
      callDetails: structuredClone(getCallDetails({ callDetails: record?.callDetails })) as Array<CallDetailLike>,
      fixedRouteCounts: off ? {} : structuredClone(record?.fixedRouteCounts || {}),
    },
    editingCallId: null,
    callFormOpen: false,
  }
}

export function dayOffPatch(off: boolean): Partial<DayDraft> {
  return off ? { isOff: true, fixedCount: 0, palletCount: 0, fixedRouteCounts: {} } : { isOff: false }
}

export type DayLogAction = { type: 'patchDraft', patch: Partial<DayDraft> }   | { type: 'openCallForm', id: string|null }   | { type: 'closeCallForm' }

export function dayLogReducer(state: DayLogState, action: DayLogAction): DayLogState {
  switch (action.type) {
    case 'patchDraft':
      return { ...state, draft: { ...state.draft, ...action.patch } }
    case 'openCallForm':
      return { ...state, callFormOpen: true, editingCallId: action.id }
    case 'closeCallForm':
      return { ...state, callFormOpen: false, editingCallId: null }
    default:
      return state
  }
}
