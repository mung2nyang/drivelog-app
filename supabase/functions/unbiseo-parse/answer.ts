import type { ParseInput } from './grok.ts'
import { readClientDraft } from './clientDraft.ts'
import type { ClientDraft } from './clientDraft.ts'
import { readFixed } from './fixedRoute.ts'
import type { Fixed } from './fixedRoute.ts'
import { readQuestion } from './question.ts'
import { readSmsDraft } from './smsDraft.ts'
import type { SmsDraft } from './smsDraft.ts'
import { readWeatherDraft } from './weatherDraft.ts'
import type { WeatherDraft } from './weatherDraft.ts'
import type { Json, Question } from './question.ts'

type Call = { date: string, loadLoc: string, unloadLoc: string, fare: number | null, client: string }
type Expense = { date: string, type: 'maint' | 'fuel' | 'misc', cost: number | null, name: string, category: string, fuelType: string, payment: string }
type Parsed = { kind: 'call', call: Call } | { kind: 'expense', expense: Expense } | { kind: 'question', question: Question } | { kind: 'fixed', fixed: Fixed } | { kind: 'client', client: ClientDraft } | { kind: 'sms', sms: SmsDraft } | { kind: 'weather', weather: WeatherDraft } | { kind: 'inspection', inspection: { date: string } } | { kind: 'dayOff', dayOff: { date: string, off: boolean } } | { kind: 'unknown' }

const PLACE_MAX = 100
const MAINT_CATEGORIES = ['엔진/미션', '판금/도장', '소모품', '기타']
const MISC_CATEGORIES = ['통행료', '주차비', '과태료', '기타']
const FUEL_TYPES = ['주유', '요소수', '전기', '기타']
const PAYMENTS = ['카드', '현금']

export function record(value: Json | undefined): { [key: string]: Json } | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

export function isDateKey(value: Json | undefined): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

function place(value: Json | undefined): string {
  return typeof value === 'string' ? value.trim().slice(0, PLACE_MAX) : ''
}

function dayOf(value: Json | undefined, today: string): string {
  return isDateKey(value) && value <= today ? value : today
}

function won(value: Json | undefined): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function clientOf(value: Json | undefined, input: ParseInput): string {
  const heard = place(value)
  return input.clientNames.find((name) => name.trim() === heard) ?? heard
}

function oneOf(value: Json | undefined, list: Array<string>): string {
  const heard = typeof value === 'string' ? value.trim() : ''
  return list.includes(heard) ? heard : ''
}

function readExpense(row: { [key: string]: Json }, today: string): Expense {
  const type = row.expenseType === 'fuel' || row.expenseType === 'misc' ? row.expenseType : 'maint'
  const categories = type === 'maint' ? MAINT_CATEGORIES : type === 'misc' ? MISC_CATEGORIES : []
  return {
    date: dayOf(row.date, today),
    type,
    cost: won(row.cost),
    name: place(row.name),
    category: oneOf(row.category, categories),
    fuelType: type === 'fuel' ? oneOf(row.fuelType, FUEL_TYPES) : '',
    payment: oneOf(row.payment, PAYMENTS),
  }
}

export function readAiAnswer(raw: string, input: ParseInput): Parsed | null {
  let parsed: Json
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const row = record(parsed)
  if (!row) return null
  if (row.kind === 'expense') return { kind: 'expense', expense: readExpense(row, input.today) }
  if (row.kind === 'question') return { kind: 'question', question: readQuestion(row, input.today, clientOf(row.client, input)) }
  if (row.kind === 'sms') return input.text.includes('문자') ? { kind: 'sms', sms: readSmsDraft(row, input.today, clientOf(row.smsClient, input)) } : { kind: 'unknown' }
  if (row.kind === 'weather') return { kind: 'weather', weather: readWeatherDraft(row, input.today) }
  if (row.kind === 'inspection') return input.text.includes('점검') ? { kind: 'inspection', inspection: { date: dayOf(row.date, input.today) } } : { kind: 'unknown' }
  if (row.kind === 'dayOff') return /휴무|쉬/.test(input.text) ? { kind: 'dayOff', dayOff: { date: isDateKey(row.date) ? row.date : input.today, off: row.dayOffCancel !== true } } : { kind: 'unknown' }
  if (row.kind === 'fixed') return { kind: 'fixed', fixed: readFixed(row, dayOf(row.date, input.today), input.routeNames) }
  if (row.kind === 'unknown') return { kind: 'unknown' }
  if (row.kind === 'client') {
    const client = readClientDraft(row)
    return client ? { kind: 'client', client } : { kind: 'unknown' }
  }
  if (row.kind !== 'call') return null
  return {
    kind: 'call',
    call: {
      date: dayOf(row.date, input.today),
      loadLoc: place(row.loadLoc),
      unloadLoc: place(row.unloadLoc),
      fare: won(row.fare),
      client: clientOf(row.client, input),
    },
  }
}
