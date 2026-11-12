import { commitExpenses } from '../store/commitHelpers.ts'
import { dedupeExpensesById } from '../../domain/expenses.ts'
import { removeExpense, upsertExpense } from '../../domain/expenseDraft.ts'
import { planExpenseVehicleTargets } from '../../domain/expenseVehicleRouting.ts'
import { getState } from '../store/app-store.ts'
import {
  assertSessionStillCurrent,
  blockedReasonForOwnerDataWrite,
  captureSession,
  getCloudOwnerKey,
  getCloudUserId,
} from '../cloud/cloudSession.ts'
import { deleteExpenseRows, syncExpenseItemsForVehicle, upsertExpenseItemsForVehicle } from './syncExpenseItems.ts'
import type { ExpenseRowRef } from './syncExpenseItems.ts'
import { NO_VEHICLE_SAVE_FAIL, saveFailMessage } from '../../shared/utils/failureMessages.ts'
import { hasNoCloudVehicle } from './mainDayLogRouting.ts'
import type { ExpenseDraft, ExpenseItem } from '../../domain/expenseTypes.ts'

export async function saveExpenses(ownerKey: string, items: Array<ExpenseItem>) {
  const next = dedupeExpensesById(items)
  if (getCloudOwnerKey() !== ownerKey) {
    commitExpenses(ownerKey, next)
    return
  }
  const userId = getCloudUserId()
  const blocked = blockedReasonForOwnerDataWrite({ ownerKey, userId })
  if (blocked) throw new Error(blocked)
  const logs = getState().workLogs[ownerKey] || {}
  const captured = captureSession()
  if (userId !== ownerKey) {
    const assignedCar = (getState().cars[ownerKey] || []).find((car) => car.supabaseId)
    const previous = (getState().expenses[ownerKey] || []) as Array<ExpenseItem>
    if (assignedCar?.supabaseId) {
      await syncExpenseItemsForVehicle((userId) as string, assignedCar.supabaseId, previous, next, logs.main || {})
    }
    assertSessionStillCurrent(captured)
    commitExpenses(ownerKey, next)
    return
  }
  const cars = getState().cars[ownerKey]
  const drivers = getState().drivers[ownerKey]
  const targets = planExpenseVehicleTargets(cars, drivers, next)
  const previousAll = (getState().expenses[ownerKey] || []) as Array<ExpenseItem>
  const previousByLog = new Map(planExpenseVehicleTargets(cars, drivers, previousAll).map((target) => [target.logId, target.expenses]))
  const mainVehicleId = targets.find((target) => target.logId === 'main')?.vehicleId ?? null
  const deletes: Array<ExpenseRowRef> = []
  for (const target of targets) {
    const ownIds = new Set(target.expenses.map((item) => item.id))
    const previous = [...(previousByLog.get(target.logId) || []), ...next.filter((item) => !ownIds.has(item.id))]
    const linked = target.mode === 'items'
    deletes.push(...await upsertExpenseItemsForVehicle((userId) as string, target.vehicleId, previous, target.expenses, logs[target.logId] || {}, linked ? mainVehicleId : null, !linked))
  }
  await deleteExpenseRows(deletes)
  assertSessionStillCurrent(captured)
  commitExpenses(ownerKey, next)
}

function latestExpenses(ownerKey: string): Array<ExpenseItem> {
  return (getState().expenses[ownerKey] || []) as Array<ExpenseItem>
}

export async function saveExpenseDraft(ownerKey: string, draft: ExpenseDraft, editingId: string | null): Promise<string | null> {
  const result = upsertExpense(latestExpenses(ownerKey), draft, editingId)
  if (result.error) return result.error
  if (hasNoCloudVehicle(ownerKey, 'main')) return NO_VEHICLE_SAVE_FAIL
  try {
    await saveExpenses(ownerKey, result.items)
    return null
  } catch (error) {
    console.error('비용 저장 실패:', error)
    return saveFailMessage(getCloudOwnerKey() === ownerKey)
  }
}

export async function deleteExpense(ownerKey: string, id: string): Promise<string | null> {
  try {
    await saveExpenses(ownerKey, removeExpense(latestExpenses(ownerKey), id))
    return null
  } catch (error) {
    console.error('비용 삭제 실패:', error)
    return saveFailMessage(getCloudOwnerKey() === ownerKey)
  }
}
