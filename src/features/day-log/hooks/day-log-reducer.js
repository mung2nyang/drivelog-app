// @ts-check
import { getCallDetails } from '../../../domain/day-record.ts'

/**
 * @typedef {Object} DayDraft
 * @property {boolean} isOff
 * @property {number} fixedCount
 * @property {number} palletCount
 * @property {Array<import('../ui/dayLogTypes.js').CallDetailLike>} callDetails
 * @property {Record<string, number>} fixedRouteCounts
 */

/**
 * @typedef {Object} DayLogState
 * @property {DayDraft} draft
 * @property {string|null} editingCallId
 * @property {boolean} callFormOpen
 */

/**
 * @param {{ isOff?: boolean, fixedCount?: number|string, palletCount?: number|string, callDetails?: Array<import('../../../domain/callDetail.ts').CallDetailLike>, fixedRouteCounts?: Record<string, number> }} [record]
 * @returns {DayLogState}
 */
export function initDayLogState(record) {
  const off = !!record?.isOff
  return {
    draft: {
      isOff: off,
      fixedCount: off ? 0 : Math.max(0, parseInt(String(record?.fixedCount ?? 0), 10) || 0),
      palletCount: off ? 0 : Math.max(0, parseInt(String(record?.palletCount ?? 0), 10) || 0),
      callDetails: /** @type {Array<import('../ui/dayLogTypes.js').CallDetailLike>} */ (structuredClone(getCallDetails({ callDetails: record?.callDetails }))),
      fixedRouteCounts: off ? {} : structuredClone(record?.fixedRouteCounts || {}),
    },
    editingCallId: null,
    callFormOpen: false,
  }
}

/** @param {boolean} off @returns {Partial<DayDraft>} */
export function dayOffPatch(off) {
  return off ? { isOff: true, fixedCount: 0, palletCount: 0, fixedRouteCounts: {} } : { isOff: false }
}

/**
 * @typedef {{ type: 'patchDraft', patch: Partial<DayDraft> }
 *   | { type: 'openCallForm', id: string|null }
 *   | { type: 'closeCallForm' }} DayLogAction
 */

/**
 * @param {DayLogState} state
 * @param {DayLogAction} action
 * @returns {DayLogState}
 */
export function dayLogReducer(state, action) {
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
