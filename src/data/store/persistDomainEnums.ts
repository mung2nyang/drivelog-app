import type { JsonValue } from '../../domain/jsonTypes.ts'

export const CAR_SETTLEMENT_MODES = ([
  'default', 'company', 'driver_direct', 'employee', 'none',
]) as const
export const COMM_TYPES = (['percent', 'direct']) as const
export const INFO_TYPES = (['existing', 'new']) as const
export const PAYMENT_TERM_VALUES = ([
  'same_day', 'after_days', 'next_month_day', 'next_month_end', 'second_month_day', 'second_month_end',
]) as const
export const DRIVER_PAY_MODES = (['revenue', 'salary']) as const
export const DRIVER_SETTLEMENT_MODES = ([
  'company', 'driver_direct', 'employee', 'none',
]) as const
export const DRIVER_INVOICE_BASES = (['net', 'gross']) as const
export const INVOICE_FLOWS = (['sales', 'purchase', 'commission']) as const
export const INVOICE_STATUSES = (['draft', 'issued']) as const
export const PARTY_TYPES = (['client', 'driver']) as const

export function isAllowedEnum(value: JsonValue, allowed: ReadonlyArray<string>) {
  return typeof value === 'string' && allowed.includes(value)
}
