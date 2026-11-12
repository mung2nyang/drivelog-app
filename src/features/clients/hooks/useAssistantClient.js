// @ts-check
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PAYMENT_TERMS, needsPaymentTermValue } from '../../../domain/clientPaymentTerms.ts'
import { formatPhoneNumber } from '../../../domain/formatPhone.ts'

/** @typedef {import('../../../domain/clientTypes.ts').ClientDraft} ClientDraft */

const NAME_MAX = 50
const MANAGER_MAX = 30

/** @param {object} row @param {string} key @param {number} max */
function textOf(row, key, max) {
  const value = Reflect.get(row, key)
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length <= max ? text : ''
}

/** @param {object} row @param {string} key */
function numberOf(row, key) {
  const value = Reflect.get(row, key)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * @param {object|null|undefined} state
 * @returns {Partial<ClientDraft>|null}
 */
export function readAssistantClient(state) {
  const row = state && typeof state === 'object' ? Reflect.get(state, 'assistantClient') : null
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const name = textOf(row, 'name', NAME_MAX)
  if (!name) return null
  /** @type {Partial<ClientDraft>} */
  const fields = { companyName: name, managerName: textOf(row, 'manager', MANAGER_MAX) }
  const digits = textOf(row, 'phone', 20).replace(/[^0-9]/g, '')
  if (digits.length >= 9 && digits.length <= 13) fields.phone = formatPhoneNumber(digits)
  const term = textOf(row, 'paymentTerm', 30)
  if (PAYMENT_TERMS.some((item) => item.value === term)) {
    const value = numberOf(row, 'paymentTermValue')
    const max = term === 'after_days' ? 365 : 31
    const valueOk = value !== null && Number.isInteger(value) && value >= 1 && value <= max
    if (!needsPaymentTermValue(term) || valueOk) {
      fields.paymentTerm = term
      fields.paymentTermValue = needsPaymentTermValue(term) && value !== null ? String(value) : ''
    }
  }
  const commType = Reflect.get(row, 'commType')
  const commValue = numberOf(row, 'commValue')
  const commOk = commValue !== null && commValue >= 0
    && ((commType === 'percent' && commValue <= 100) || (commType === 'direct' && Number.isSafeInteger(commValue)))
  if (commOk) Object.assign(fields, { commEnabled: true, commType, commValue: String(commValue) })
  return fields
}

/** @param {(fields: Partial<ClientDraft>) => void} openWith */
export default function useAssistantClient(openWith) {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const fields = readAssistantClient(location.state)
    if (!fields) return
    navigate(`${location.pathname}${location.search}`, { replace: true, state: { from: location.state?.from } })
    openWith(fields)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, navigate])
}
