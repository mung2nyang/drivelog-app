import { parseCurrencyValue } from './money.ts'
import type { CarLike } from './financeTypes.ts'

export type InsuranceSplit = 'owner' | 'half' | 'driver'
export type DriverIncomeDraft = { driverIncomeType?: string, insuranceOn?: boolean, withholdingOn?: boolean, expenseRate?: string | number, insuranceRate?: string | number, insuranceSplit?: string }
export type DriverIncomeFields = { driverIncomeType: 'employee' | 'business', insuranceOn: boolean, withholdingOn: boolean, expenseRate: string, insuranceRate: string, insuranceSplit: InsuranceSplit }

export const DEFAULT_EXPENSE_RATE = '49.9'
export const DEFAULT_INSURANCE_RATE = '1.76'
const LEGACY_EXPENSE_RATE = 30.5
const LEGACY_INSURANCE_RATE = 1.8
const WITHHOLDING_RATE = 3.3

export const NEW_DRIVER_INCOME_DRAFT: DriverIncomeFields = {
  driverIncomeType: 'business',
  insuranceOn: true,
  withholdingOn: true,
  expenseRate: DEFAULT_EXPENSE_RATE,
  insuranceRate: DEFAULT_INSURANCE_RATE,
  insuranceSplit: 'half',
}

export function isInsuranceSplit(value: string | null | undefined): value is InsuranceSplit {
  return value === 'owner' || value === 'half' || value === 'driver'
}

export function insuranceSplitOf(car: { insuranceSplit?: string | null, driverIncomeType?: string | null } | null | undefined): InsuranceSplit {
  if (isInsuranceSplit(car?.insuranceSplit)) return car.insuranceSplit
  return car?.driverIncomeType === 'employee' ? 'owner' : 'half'
}

export function hasDriverInsuranceShare(car: CarLike | null | undefined) {
  return !!car?.insuranceOn && insuranceSplitOf(car) !== 'owner'
}

function floorWon(value: number) {
  return Math.floor(value + 1e-6)
}

function floorTen(value: number) {
  return Math.floor(value / 10 + 1e-6) * 10
}

function isRate(value: string | number | null | undefined, target: number) {
  return parseFloat(String(value ?? '')) === target
}

export function withCurrentDefaultRates(cars: Array<CarLike>): Array<CarLike> {
  let changed = false
  const next = cars.map((car) => {
    const expense = isRate(car?.expenseRate, LEGACY_EXPENSE_RATE)
    const insurance = isRate(car?.insuranceRate, LEGACY_INSURANCE_RATE)
    if (!expense && !insurance) return car
    changed = true
    return { ...car, ...(expense ? { expenseRate: DEFAULT_EXPENSE_RATE } : {}), ...(insurance ? { insuranceRate: DEFAULT_INSURANCE_RATE } : {}) }
  })
  return changed ? next : cars
}

function rateOf(value: string | number | null | undefined, fallback: string) {
  const text = String(value ?? '').trim()
  const parsed = parseFloat(text === '' ? fallback : text)
  return Math.min(100, Math.max(0, Number.isFinite(parsed) ? parsed : parseFloat(fallback)))
}

export function driverIncomeFieldsFromDraft(draft: DriverIncomeDraft): DriverIncomeFields {
  return {
    driverIncomeType: draft.driverIncomeType === 'employee' ? 'employee' : 'business',
    insuranceOn: !!draft.insuranceOn,
    withholdingOn: !!draft.withholdingOn,
    expenseRate: String(rateOf(draft.expenseRate, DEFAULT_EXPENSE_RATE)),
    insuranceRate: String(rateOf(draft.insuranceRate, DEFAULT_INSURANCE_RATE)),
    insuranceSplit: insuranceSplitOf(draft),
  }
}

export function driverIncomeDraftFromCar(car: CarLike): DriverIncomeFields {
  return {
    driverIncomeType: car.driverIncomeType === 'employee' ? 'employee' : 'business',
    insuranceOn: !!car.insuranceOn,
    withholdingOn: !!car.withholdingOn,
    expenseRate: String(car.expenseRate ?? DEFAULT_EXPENSE_RATE),
    insuranceRate: String(car.insuranceRate ?? DEFAULT_INSURANCE_RATE),
    insuranceSplit: insuranceSplitOf(car),
  }
}

export function getDriverSettlementAmount(car: CarLike | null | undefined, commissionAmount: number) {
  return car?.driverPayMode === 'salary' ? parseCurrencyValue(car.driverSalaryAmount) : commissionAmount
}

export function getDriverIncomeDeductions(car: CarLike | null | undefined, settlementAmount: number) {
  const amount = Math.max(0, Math.floor(Number(settlementAmount) || 0))
  const insuranceBase = amount - floorWon(amount * rateOf(car?.expenseRate, DEFAULT_EXPENSE_RATE) / 100)
  const insuranceRate = car?.insuranceOn ? rateOf(car?.insuranceRate, DEFAULT_INSURANCE_RATE) : 0
  const split = insuranceSplitOf(car)
  const fullShare = floorTen(insuranceBase * insuranceRate / 100)
  const halfShare = floorTen(insuranceBase * insuranceRate / 200)
  const insuranceDriverShare = split === 'owner' ? 0 : split === 'driver' ? fullShare : halfShare
  const insuranceOwnerShare = split === 'driver' ? 0 : split === 'owner' ? fullShare : halfShare
  const withholding = car?.withholdingOn ? floorWon(amount * WITHHOLDING_RATE / 100) : 0
  return {
    settlementAmount: amount,
    insuranceBase,
    insuranceTotal: insuranceDriverShare + insuranceOwnerShare,
    insuranceDriverShare,
    insuranceOwnerShare,
    withholding,
    driverNet: amount - insuranceDriverShare - withholding,
  }
}

export function getDriverSettlementBreakdown(
  detail: { totalFare?: number, commissionAmount?: number } | null | undefined,
  car: CarLike | null | undefined,
) {
  const settlementAmount = getDriverSettlementAmount(car, detail?.commissionAmount || 0)
  return { totalFare: detail?.totalFare || 0, ...getDriverIncomeDeductions(car, settlementAmount) }
}
