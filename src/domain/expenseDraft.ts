import { generateLocalId } from './localId.ts'
import { FUEL_TYPES, MAINT_CATEGORIES, MISC_CATEGORIES, todayKey } from './expenses.ts'
import type { ExpenseDraft, ExpenseItem } from './expenseTypes.ts'

export function emptyExpenseDraft(kind: string, date: string = todayKey(), vehicleNumber?: string) {
  const draft: ExpenseDraft = {
    kind,
    date,
    name: '',
    category: kind === 'misc' ? MISC_CATEGORIES[0] : MAINT_CATEGORIES[0],
    fuelType: '주유',
    payment: '카드',
    cost: 0,
    subsidy: 0,
    mileage: 0,
    liters: '',
  }
  const vn = String(vehicleNumber || '').trim()
  if (vn) draft.vehicleNumber = vn
  return draft
}

export function expenseToDraft(item: ExpenseItem, date: string = item.date): ExpenseDraft {
  return {
    kind: item.kind, date, name: item.name || '',
    category: item.category || (item.kind === 'misc' ? '통행료' : '엔진/미션'),
    fuelType: item.fuelType || '주유', payment: item.payment || '카드',
    cost: item.cost || 0, subsidy: item.subsidy || 0, mileage: item.mileage || 0,
    liters: String(item.liters || ''),
    vehicleNumber: item.vehicleNumber,
  }
}

export function checkExpenseDraft(draft: ExpenseDraft): { field: 'date' | 'name' | 'cost', message: string } | null {
  const cost = Math.max(0, parseInt(String(draft.cost), 10) || 0)
  if (!String(draft.date || '').trim()) return { field: 'date', message: '날짜를 선택해 주세요.' }
  if (draft.kind === 'fuel') return cost ? null : { field: 'cost', message: '비용을 입력해 주세요.' }
  return String(draft.name || '').trim() || cost ? null : { field: 'name', message: '항목명 또는 비용을 입력해 주세요.' }
}

export function upsertExpense(items: Array<ExpenseItem>, draft: ExpenseDraft, editingId: string | null = null) {
  const kind = ['maint', 'fuel', 'misc'].includes(String(draft.kind)) ? draft.kind : 'maint'
  const date = String(draft.date || '').trim()
  const name = String(draft.name || '').trim()
  const category = String(draft.category || '').trim()
  const fuelType = FUEL_TYPES.includes(String(draft.fuelType)) ? draft.fuelType : '주유'
  const payment = draft.payment === '현금' ? '현금' : '카드'
  const cost = Math.max(0, parseInt(String(draft.cost), 10) || 0)
  const subsidy = Math.max(0, parseInt(String(draft.subsidy), 10) || 0)
  const mileage = Math.max(0, parseInt(String(draft.mileage), 10) || 0)
  const liters = Math.max(0, Number.parseFloat(String(draft.liters)) || 0)
  const vehicleNumber = String(draft.vehicleNumber || '').trim() || undefined

  const problem = checkExpenseDraft(draft)
  if (problem) return { error: problem.message, items }

  const next = {
    kind: kind as ExpenseItem['kind'],
    date,
    name: kind === 'fuel' ? fuelType : name,
    category: kind === 'fuel' ? fuelType : category,
    fuelType,
    payment,
    cost,
    subsidy: kind === 'fuel' ? subsidy : 0,
    mileage,
    liters: kind === 'fuel' ? liters : 0,
    vehicleNumber,
  }
  const list = [...(items || [])]

  if (editingId) {
    const idx = list.findIndex((item) => item.id === editingId)
    if (idx < 0) return { error: '내역을 찾지 못했습니다.', items }
    list[idx] = { ...list[idx], ...next }
    return { items: list }
  }

  list.push({ id: generateLocalId('exp'), ...next })
  return { items: list }
}

export function removeExpense(items: Array<ExpenseItem>, id: string) {
  return (items || []).filter((item) => item.id !== id)
}
