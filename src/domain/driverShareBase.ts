import { getFixedRouteClient, resolveFixedUnitPrice } from './clients.ts'
import { getCallDetails, getFixedCount } from './day-record.ts'
import { isDateWithinAssignment } from './drivers.ts'
import { getCallDetailCommissionAmount } from './financeCore.ts'
import { getFixedRouteCommissionAmount } from './fixedRouteCommission.ts'
import { parseCurrencyValue } from './money.ts'
import type { CarLike, DriverLinkLike, FinanceSettings } from './financeTypes.ts'
import type { DayRecordLike } from './day-record.ts'

export function resolveDriverShareBase(car: CarLike | null | undefined): 'gross' | 'afterClientCommission' {
  return car?.driverShareBase === 'afterClientCommission' ? 'afterClientCommission' : 'gross'
}

export function driverShareBaseAmount(car: CarLike | null | undefined, grossAmount: number, clientCommission: number) {
  return resolveDriverShareBase(car) === 'afterClientCommission' ? grossAmount - clientCommission : grossAmount
}

export function getMonthlyDriverClientCommission(data: Record<string, DayRecordLike> | null | undefined, monthKey: string, link: DriverLinkLike | null = null, settings: FinanceSettings = {}, scopeKey?: string) {
  const key = scopeKey || link?.vehicleNumber
  const fixedRouteClient = getFixedRouteClient(settings, key)
  const fixedUnitPrice = resolveFixedUnitPrice(settings, key)
  let total = 0
  Object.entries(data || {}).forEach(([dateKey, record]) => {
    if (!dateKey.startsWith(monthKey) || !record || typeof record !== 'object' || record.isOff) return
    if (!isDateWithinAssignment(dateKey, link?.assignmentStart, link?.assignmentEnd)) return
    getCallDetails(record).forEach((detail) => {
      const workDate = detail.workDate || dateKey
      if (!workDate.startsWith(monthKey) || !isDateWithinAssignment(workDate, link?.assignmentStart, link?.assignmentEnd)) return
      total += getCallDetailCommissionAmount(detail, parseCurrencyValue(detail.fare), settings)
    })
    const fixedCount = getFixedCount(record)
    if (fixedCount > 0) total += getFixedRouteCommissionAmount(fixedRouteClient, fixedCount * fixedUnitPrice, fixedCount)
  })
  return total
}
