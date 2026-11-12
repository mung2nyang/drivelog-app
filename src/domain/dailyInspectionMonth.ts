import type { InspectionItems } from './dailyInspectionItems.ts'

export type InspectionMark = 'O' | 'X' | '미' | ''

export const RANGE_LABELS = ['1~8일', '9~16일', '17~24일', '25~31일']

export function rangeDays(year: number, month: number, rangeIndex: number): Array<number> {
  const last = new Date(year, month + 1, 0).getDate()
  const start = rangeIndex * 8 + 1
  const end = rangeIndex === 3 ? last : Math.min(start + 7, last)
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i)
}

export function initialRangeIndex(year: number, month: number, today: Date) {
  if (today.getFullYear() !== year || today.getMonth() !== month) return 0
  return Math.min(3, Math.floor((today.getDate() - 1) / 8))
}

export function dateKeyOf(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function inspectionMark({ dateKey, todayKey, isOff, items, itemKey }: { dateKey: string, todayKey: string, isOff: boolean, items: InspectionItems | null | undefined, itemKey: string }): InspectionMark {
  if (dateKey > todayKey) return ''
  if (isOff || !items) return '미'
  const value = items[itemKey]
  if (value === 'good') return 'O'
  if (value === 'bad') return 'X'
  return '미'
}

export type MonthInspection = { items: InspectionItems, actionNote: string, inspectorName: string }

export function monthDays(year: number, month: number): Array<number> {
  return Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => i + 1)
}

export function legalFormMark(mark: InspectionMark) {
  if (mark === 'O') return '○'
  if (mark === 'X') return '×'
  return mark
}

export function inspectorCell({ dateKey, todayKey, isOff, record }: { dateKey: string, todayKey: string, isOff: boolean, record: MonthInspection | null | undefined }) {
  if (dateKey > todayKey || isOff || !record) return ''
  return record.inspectorName.trim()
}

export function actionNoteLines(byDate: Record<string, MonthInspection>): Array<string> {
  return Object.keys(byDate).sort()
    .map((dateKey) => ({ day: Number(dateKey.slice(8)), note: byDate[dateKey].actionNote.trim() }))
    .filter((line) => line.note)
    .map((line) => `${line.day}일 ${line.note}`)
}

export function inspectionFileBaseName(year: number, month: number, carNumber: string) {
  const car = String(carNumber || '').trim()
  return `일상점검표_${year}년${month + 1}월${car ? `_${car}` : ''}`
}
