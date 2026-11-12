import type { JsonValue } from './jsonTypes.ts'

export function parseCurrencyValue(str: JsonValue | undefined): number {
  if (!str) return 0
  return parseInt(String(str).replace(/[^0-9]/g, ''), 10) || 0
}

export function vatOf(amount: number) {
  return Math.floor(amount / 10)
}

export function formatWon(amount: JsonValue | undefined): string {
  return `${Math.max(0, Number(amount) || 0).toLocaleString('ko-KR')}원`
}

export function formatCurrencyInput(value: JsonValue | undefined): string {
  const n = parseCurrencyValue(value)
  return n ? n.toLocaleString('ko-KR') : ''
}

export function roundCurrencyText(text: string | undefined): string {
  const raw = String(text ?? '').replace(/[^0-9.]/g, '')
  const dot = raw.indexOf('.')
  const intPart = dot >= 0 ? raw.slice(0, dot) : raw
  const fracPart = dot >= 0 ? raw.slice(dot + 1).replace(/\./g, '') : ''
  const n = Math.round(Number(`${intPart || '0'}.${fracPart || '0'}`))
  return n ? n.toLocaleString('ko-KR') : ''
}

export const LARGE_FARE_LIMIT = 10000000

export function isLargeFare(text: JsonValue | undefined): boolean {
  return parseCurrencyValue(text) > LARGE_FARE_LIMIT
}

export function formatPercentInput(value: JsonValue | undefined): string {
  let next = String(value || '').replace(/[^0-9.]/g, '')
  if (parseFloat(next) > 100) next = '100'
  return next
}
