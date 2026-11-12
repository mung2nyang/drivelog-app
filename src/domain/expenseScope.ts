import type { ExpenseItem } from './expenseTypes.ts'

export function getExpensesForLog(items: Array<ExpenseItem> | null | undefined, logId?: string): Array<ExpenseItem> {
  const list = items || []
  const key = String(logId || '').trim()
  if (!key || key === 'main') {
    return list.filter((item) => !item.vehicleNumber)
  }
  return list.filter((item) => item.vehicleNumber === key)
}
