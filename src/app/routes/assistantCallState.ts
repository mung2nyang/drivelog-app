import type { UnbiseoRecord } from '../../features/home/api/unbiseoParse.ts'
import { FUEL_TYPES, MAINT_CATEGORIES, MISC_CATEGORIES } from '../../domain/expenses.ts'

const TEXT_MAX = 100
const PAYMENTS = ['카드', '현금']
const FIXED_COUNT_MAX = 20

export type AssistantCall = { loadLoc: string, unloadLoc: string, fare: number | null, client: string, cancelOff: boolean }
export type AssistantExpense = { type: 'maint' | 'fuel' | 'misc', cost: number | null, name: string, category: string, fuelType: string, payment: string, cancelOff: boolean }
export type AssistantFixed = { count: number, route: string, cancelOff: boolean }
export type AssistantDayOff = { off: boolean }

function textOf(row: object, key: string) {
  const value = Reflect.get(row, key)
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length > TEXT_MAX ? '' : trimmed
}

function wonOf(row: object, key: string) {
  const value = Reflect.get(row, key)
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function oneOf(row: object, key: string, list: Array<string>) {
  const value = textOf(row, key)
  return list.includes(value) ? value : ''
}

function rowOf(state: object | null | undefined, key: string) {
  const row = state && typeof state === 'object' ? Reflect.get(state, key) : null
  return row && typeof row === 'object' && !Array.isArray(row) ? row : null
}

export function readAssistantCall(state: object | null | undefined): AssistantCall | null {
  const row = rowOf(state, 'assistantCall')
  if (!row) return null
  return {
    loadLoc: textOf(row, 'loadLoc'),
    unloadLoc: textOf(row, 'unloadLoc'),
    fare: wonOf(row, 'fare'),
    client: textOf(row, 'client'),
    cancelOff: Reflect.get(row, 'cancelOff') === true,
  }
}

export function readAssistantExpense(state: object | null | undefined): AssistantExpense | null {
  const row = rowOf(state, 'assistantExpense')
  if (!row) return null
  const raw = Reflect.get(row, 'type')
  const type: 'maint' | 'fuel' | 'misc' = raw === 'fuel' ? 'fuel' : raw === 'misc' ? 'misc' : 'maint'
  const categories = type === 'maint' ? MAINT_CATEGORIES : type === 'misc' ? MISC_CATEGORIES : []
  return {
    type,
    cost: wonOf(row, 'cost'),
    name: textOf(row, 'name'),
    category: oneOf(row, 'category', categories),
    fuelType: type === 'fuel' ? oneOf(row, 'fuelType', FUEL_TYPES) : '',
    payment: oneOf(row, 'payment', PAYMENTS),
    cancelOff: Reflect.get(row, 'cancelOff') === true,
  }
}

export function readAssistantFixed(state: object | null | undefined): AssistantFixed | null {
  const row = rowOf(state, 'assistantFixed')
  const count = row ? Reflect.get(row, 'count') : null
  if (!row || typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > FIXED_COUNT_MAX) return null
  return { count, route: textOf(row, 'route'), cancelOff: Reflect.get(row, 'cancelOff') === true }
}

export function readAssistantDayOff(state: object | null | undefined): AssistantDayOff | null {
  const off = Reflect.get(rowOf(state, 'assistantDayOff') || {}, 'off')
  return typeof off === 'boolean' ? { off } : null
}

export function assistantCallNavState(record: UnbiseoRecord, options: { cancelOff: boolean }) {
  if ('paymentTerm' in record) return { from: 'home', assistantClient: { ...record } }
  if ('off' in record) return { from: 'home', assistantDayOff: { off: record.off } }
  if ('count' in record) return { from: 'home', assistantFixed: { count: record.count, route: record.route, cancelOff: options.cancelOff } }
  if ('type' in record) {
    const { type, cost, name, category, fuelType, payment } = record
    return { from: 'home', assistantExpense: { type, cost, name, category, fuelType, payment, cancelOff: options.cancelOff } }
  }
  return { from: 'home', assistantCall: { loadLoc: record.loadLoc, unloadLoc: record.unloadLoc, fare: record.fare, client: record.client, cancelOff: options.cancelOff } }
}

export function assistantNavTarget(record: UnbiseoRecord, options: { cancelOff: boolean }): [string, { state: object }] {
  const state = assistantCallNavState(record, options)
  return ['paymentTerm' in record ? '/app/clients' : `/app/day/${record.date}`, { state }]
}
