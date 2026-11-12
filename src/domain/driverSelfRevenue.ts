import { getShortCarNum, isVehicleRevenueSharedWithOwner } from './cars.ts'
import { getDriverIncomeDeductions, getDriverSettlementAmount, hasDriverInsuranceShare } from './driverIncomeDeductions.ts'
import {
  calculateDriverVehicleCommission,
  getMonthlyDriverTotals,
  logData,
} from './financeCore.ts'
import { getOwnerMonthlyFinanceDetail } from './financeOwnerDetail.ts'
import { driverShareBaseAmount, getMonthlyDriverClientCommission } from './driverShareBase.ts'
import type { CarLike, FinanceSettings, WorkDataByLogId } from './financeTypes.ts'
import type { ExpenseItem } from './expenseTypes.ts'

const EMPTY_BUCKET = { total: 0, items: [] as Array<{ date: string, label: string, amount: number }> }

function settlementLabelForCar(car: CarLike, shareAmount: number) {
  if (car.driverPayMode === 'salary') return '기사 정산(월급)'
  if (shareAmount > 0 && car.commission) {
    const rate = String(car.commission).replace(/%/g, '').trim()
    if (rate) return `기사 정산(${rate}%)`
  }
  return '기사 정산'
}

function firstAssignedSubCar(settings: FinanceSettings): CarLike | null {
  const cars = Array.isArray(settings.cars) ? settings.cars : []
  const shared = cars.filter((car) => car.type === 'sub' && isVehicleRevenueSharedWithOwner(car))
  return shared[0] || null
}

export function getDriverSelfMonthlyDetail(monthKey: string, settings: FinanceSettings = {}, workDataByLogId: WorkDataByLogId = {}, expenses: Array<ExpenseItem> = []) {
  const assigned = firstAssignedSubCar(settings)
  const base = getOwnerMonthlyFinanceDetail(monthKey, 'owner', settings, workDataByLogId, expenses, [], assigned?.number)
  const monthStart = `${monthKey}-01`

  let settlementTotal = 0
  let label = '기사 정산'
  let items: Array<{ date: string, label: string, amount: number }> = []
  let breakdown = { amount: 0, insurance: 0, withholding: 0, showInsurance: false, showWithholding: false }

  if (assigned) {
    const links = Array.isArray(settings?.driverLinks) ? settings.driverLinks : []
    const link = links.find((item) => item.id === assigned.driverLinkId || item.vehicleNumber === assigned.number) || null
    const ownData = logData(workDataByLogId, 'main')
    const totals = getMonthlyDriverTotals(ownData, monthKey, link, settings)
    const base = driverShareBaseAmount(assigned, totals.grossAmount, getMonthlyDriverClientCommission(ownData, monthKey, link, settings))
    const commission = calculateDriverVehicleCommission(assigned, base)
    const settlementAmount = getDriverSettlementAmount(assigned, commission)
    const deductions = getDriverIncomeDeductions(assigned, settlementAmount)
    settlementTotal = deductions.driverNet
    breakdown = {
      amount: deductions.settlementAmount,
      insurance: deductions.insuranceDriverShare,
      withholding: deductions.withholding,
      showInsurance: hasDriverInsuranceShare(assigned),
      showWithholding: !!assigned.withholdingOn,
    }
    label = settlementLabelForCar(assigned, settlementTotal)
    if (settlementTotal > 0) {
      items = [{
        date: monthStart,
        label: assigned.driverName || getShortCarNum(assigned.number),
        amount: settlementTotal,
      }]
    }
  }

  return {
    ...base,
    netProfit: settlementTotal,
    income: {
      fare: base.income.fare,
      commission: base.income.commission,
      insurance: base.income.insurance,
      fuelSubsidy: EMPTY_BUCKET,
      settlement: {
        total: settlementTotal,
        items,
        label,
        payMode: assigned?.driverPayMode || null,
        breakdown,
      },
      total: (Number(base.income.fare.total) || 0) - (Number(base.income.commission.total) || 0) - (Number(base.income.insurance.total) || 0),
    },
    expense: base.expense,
  }
}
