import type { CarLike } from './financeTypes.ts'
import type { ExpenseItem } from './expenseTypes.ts'
import type { DriverRecord } from './driverTypes.ts'

export type ExpenseVehicleTarget = {
  vehicleId: string | number
  logId: string
  expenses: Array<ExpenseItem>
  mode: 'dates' | 'items'
}

export function isLinkedPlate(plate: string, drivers: Array<DriverRecord> | null | undefined) {
  const want = String(plate || '').trim()
  if (!want) return false
  return (Array.isArray(drivers) ? drivers : []).some(
    (driver) => driver.status === 'linked' && String(driver.vehicleNumber || '').trim() === want,
  )
}

export function planExpenseVehicleTargets(cars: Array<CarLike> | null | undefined, drivers: Array<DriverRecord> | null | undefined, expenses: Array<ExpenseItem> | null | undefined): Array<ExpenseVehicleTarget> {
  const carList = Array.isArray(cars) ? cars : []
  const mainCar = carList.find((car) => car.type === 'main' && car.supabaseId)
  if (!mainCar?.supabaseId) return []

  const subTargets = new Map<string, ExpenseVehicleTarget>()
  const mainItems: Array<ExpenseItem> = []
  for (const car of carList) {
    const plate = String(car.number || '').trim()
    if (car === mainCar || car.type !== 'sub' || !car.supabaseId || !plate) continue
    const mode = isLinkedPlate(plate, drivers) ? 'items' : 'dates'
    subTargets.set(plate, { vehicleId: car.supabaseId, logId: plate, expenses: [], mode })
  }

  for (const item of expenses || []) {
    const plate = String(item.vehicleNumber || '').trim()
    const subCar = plate
      ? carList.find((car) => car !== mainCar && car.type === 'sub' && car.supabaseId && String(car.number || '').trim() === plate)
      : undefined
    if (!subCar?.supabaseId) {
      mainItems.push(item)
      continue
    }
    let target = subTargets.get(plate)
    if (!target) {
      target = { vehicleId: subCar.supabaseId, logId: plate, expenses: [], mode: 'dates' }
      subTargets.set(plate, target)
    }
    target.expenses.push(item)
  }

  return [
    ...subTargets.values(),
    { vehicleId: mainCar.supabaseId, logId: 'main', expenses: mainItems, mode: 'dates' },
  ]
}
