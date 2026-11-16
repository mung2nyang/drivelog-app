import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PAYMENT_TERMS, needsPaymentTermValue } from '../../../domain/clientPaymentTerms.ts'
import { formatPhoneNumber } from '../../../domain/formatPhone.ts'
import type { ClientDraft } from '../../../domain/clientTypes.ts'

const NAME_MAX = 50
const MANAGER_MAX = 30

function textOf(row: object, key: string, max: number) {
  const value = Reflect.get(row, key)
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length <= max ? text : ''
}

function numberOf(row: object, key: string) {
  const value = Reflect.get(row, key)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function readAssistantClient(state: object|null|undefined): Partial<ClientDraft>|null {
  const row = state && typeof state === 'object' ? Reflect.get(state, 'assistantClient') : null
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const name = textOf(row, 'name', NAME_MAX)
  if (!name) return null
  const fields: Partial<ClientDraft> = { companyName: name, managerName: textOf(row, 'manager', MANAGER_MAX) }
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

export default function useAssistantClient(openWith: (fields: Partial<ClientDraft>) => void) {
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
