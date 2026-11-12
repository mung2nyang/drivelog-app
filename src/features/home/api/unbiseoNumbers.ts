import { getOwnerMonthlyFinanceDetail, getReceivableItems, getTaxInvoiceSourceGroups } from '../../../domain/finance.ts'
import { getDriverSelfMonthlyDetail } from '../../../domain/driverSelfRevenue.ts'
import { dayFareTotal, expensesForVehicleDay } from '../../../domain/calendarBadges.ts'
import { resolveLogSettings } from '../../../domain/carSettingsScope.ts'
import { getFixedRouteClient } from '../../../domain/clients.ts'
import { dayTripCount } from '../../../domain/day-record.ts'
import { parseCurrencyValue } from '../../../domain/money.ts'
import { buildFinanceSettings } from '../../../data/sync/ownerFinance.ts'
import { readOwnerCars, readOwnerClients, readOwnerDriverExpenses, readOwnerExpenses, readOwnerSettings, readOwnerWorkDataByLogId } from '../../../data/store/ownerDataHooks.ts'
import type { QuestionNumbers, QuestionPeriod, UnbiseoQuestion } from './unbiseoQuestion.ts'

export function monthsOf(period: QuestionPeriod): Array<string> {
  if (period.unit === 'month') return [period.value]
  if (period.unit === 'year') return Array.from({ length: 12 }, (_, i) => `${period.value}-${String(i + 1).padStart(2, '0')}`)
  return []
}

function inPeriod(workDate: string, period: QuestionPeriod): boolean {
  if (period.unit === 'day' || period.unit === 'month' || period.unit === 'year') return String(workDate || '').startsWith(period.value)
  return true
}

export function questionNumbers(ownerKey: string, question: UnbiseoQuestion, isDriver: boolean): QuestionNumbers {
  const settings = buildFinanceSettings(ownerKey)
  const workDataByLogId = readOwnerWorkDataByLogId(ownerKey)
  const months = monthsOf(question.period)

  if (question.type === 'unpaid') {
    const items = getReceivableItems(settings, workDataByLogId)
      .filter((item) => (!question.client || item.client === question.client) && inPeriod(item.workDate, question.period))
    const withSub = items.some((item) => item.logId !== 'main')
    return { amount: items.reduce((sum, item) => sum + item.remainingAmount, 0), count: items.length, supply: 0, withSub }
  }

  if (question.period.unit === 'day') return dayNumbers(ownerKey, question, question.period.value, isDriver)

  if (question.type === 'revenue' && question.client) {
    let supply = 0
    let amount = 0
    let count = 0
    months.forEach((monthKey) => {
      getTaxInvoiceSourceGroups(monthKey, 'sales', settings, workDataByLogId, 'main')
        .filter((group) => group.clientName === question.client)
        .forEach((group) => { supply += group.supplyAmount; amount += group.totalAmount; count += group.count })
    })
    return { amount, count, supply }
  }

  const expenses = readOwnerExpenses(ownerKey)
  const driverExpenses = readOwnerDriverExpenses(ownerKey)
  const details = months.map((monthKey) => (isDriver
    ? getDriverSelfMonthlyDetail(monthKey, settings, workDataByLogId, expenses)
    : getOwnerMonthlyFinanceDetail(monthKey, 'owner', settings, workDataByLogId, expenses, driverExpenses)))
  const sum = (pick: (detail: (typeof details)[number]) => number) => details.reduce((total, detail) => total + (Number(pick(detail)) || 0), 0)
  if (question.type === 'trips') return { amount: 0, count: sum((detail) => detail.tripCount), supply: 0 }
  if (question.type === 'netProfit') return { amount: sum((detail) => detail.netProfit), count: 0, supply: 0 }
  if (question.type === 'expense') {
    const kind = question.expenseType
    return { amount: sum((detail) => (kind ? detail.expense[kind].total : detail.expense.total)), count: 0, supply: 0 }
  }
  return { amount: sum((detail) => detail.income.total), count: 0, supply: 0 }
}

function dayNumbers(ownerKey: string, question: UnbiseoQuestion, dateKey: string, isDriver: boolean): QuestionNumbers {
  if (question.type === 'expense') {
    const items = expensesForVehicleDay(readOwnerExpenses(ownerKey), dateKey)
      .filter((item) => !question.expenseType || item.kind === question.expenseType)
    return { amount: items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0), count: 0, supply: 0 }
  }
  const record = readOwnerWorkDataByLogId(ownerKey).main?.[dateKey]
  if (!record || record.isOff) return { amount: 0, count: 0, supply: 0 }
  if (question.type === 'trips') return { amount: 0, count: dayTripCount(record), supply: 0 }
  const scopeKey = isDriver ? (readOwnerCars(ownerKey)[0]?.number || 'main') : 'main'
  const client = getFixedRouteClient({ clients: readOwnerClients(ownerKey) }, scopeKey)
  const palletOn = !!(resolveLogSettings(readOwnerSettings(ownerKey), 'main').fixedOn && client?.palletOn)
  return { amount: dayFareTotal(record, client?.fixedUnitPrice ?? 0, palletOn ? parseCurrencyValue(client?.palletPrice) : 0), count: 0, supply: 0 }
}
