import { getShortCarNum } from './cars.ts'
import { getDriverIncomeDeductions, getDriverSettlementAmount } from './driverIncomeDeductions.ts'
import {
  calculateDriverVehicleCommission,
  getDriverCarWorkData,
  getMonthlyDriverTotals,
} from './financeCore.ts'
import { driverShareBaseAmount, getMonthlyDriverClientCommission } from './driverShareBase.ts'
import type { CarLike, DriverLinkLike, FinanceSettings, WorkDataByLogId } from './financeTypes.ts'
import type { DayRecordLike } from './day-record.ts'

function activeLinkForCar(links: Array<DriverLinkLike>, car: CarLike): DriverLinkLike | null {
  return links.find((item) => item.status === 'linked' && (item.id === car.driverLinkId || item.vehicleNumber === car.number)) || null
}

function shortDate(dateKey: string | undefined) {
  const [, m, d] = String(dateKey || '').split('-').map(Number)
  return m && d ? `${m}/${d}` : ''
}

function dayBefore(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

function driverLabel(car: CarLike, link: DriverLinkLike | null) {
  const name = car.driverName || getShortCarNum(car.number)
  if (!link) return name
  return `${name} (${shortDate(link.assignmentStart)}~${shortDate(link.assignmentEnd)})`
}

function previousContracts(settings: FinanceSettings, car: CarLike, link: DriverLinkLike | null): Array<DriverLinkLike & { assignmentStart: string, assignmentEnd: string }> {
  const history = (Array.isArray(settings?.driverHistory) ? settings.driverHistory : [])
    .filter((item) => item.vehicleNumber === car.number && item.assignmentStart && item.assignmentEnd)
  const starts = history.map((item) => String(item.assignmentStart)).concat(link?.assignmentStart ? [link.assignmentStart] : [])
  return history.map((item) => {
    const start = String(item.assignmentStart)
    const end = String(item.assignmentEnd)
    const nextStart = starts.filter((value) => value > start).sort()[0]
    return { ...item, assignmentStart: start, assignmentEnd: nextStart && nextStart <= end ? dayBefore(nextStart) : end }
  }).filter((item) => item.assignmentEnd >= item.assignmentStart).sort((a, b) => a.assignmentStart.localeCompare(b.assignmentStart))
}

type PeriodShare = { gross: number, count: number, share: number }
type DriverPayLine = { label: string, note: string, share: number }
export type PreviousDriverPeriod = PeriodShare & { label: string }

function periodShare(carData: Record<string, DayRecordLike>, monthKey: string, period: DriverLinkLike | null, settings: FinanceSettings, car: CarLike): PeriodShare {
  const totals = getMonthlyDriverTotals(carData, monthKey, period, settings, car.number)
  const base = driverShareBaseAmount(car, totals.grossAmount, getMonthlyDriverClientCommission(carData, monthKey, period, settings, car.number))
  return { gross: totals.grossAmount, count: totals.count, share: calculateDriverVehicleCommission(car, base) }
}

export function getPreviousDriverPeriods(monthKey: string, settings: FinanceSettings, car: CarLike, carData: Record<string, DayRecordLike>, link: DriverLinkLike | null): Array<PreviousDriverPeriod> {
  if (car.driverPayMode === 'salary') return []
  return previousContracts(settings, car, link).map((period) => ({
    label: `${period.driverName || '이전 기사'} (${shortDate(period.assignmentStart)}~${shortDate(period.assignmentEnd)})`,
    ...periodShare(carData, monthKey, period, settings, car),
  }))
}

function driverPayLines(monthKey: string, settings: FinanceSettings, car: CarLike, workDataByLogId: WorkDataByLogId): Array<DriverPayLine> {
  const links = Array.isArray(settings?.driverLinks) ? settings.driverLinks : []
  const link = activeLinkForCar(links, car)
  const carData = getDriverCarWorkData(car, workDataByLogId)
  const current = periodShare(carData, monthKey, link, settings, car)
  if (car.driverPayMode === 'salary') return [{ label: driverLabel(car, link), note: '', share: current.share }]

  const past = getPreviousDriverPeriods(monthKey, settings, car, carData, link)
  const lines: Array<DriverPayLine> = past.map(({ label, share }) => ({ label, note: '', share }))
  const pastGross = past.reduce((sum, item) => sum + item.gross, 0)
  const pastShare = past.reduce((sum, item) => sum + item.share, 0)
  if (link) {
    const outside = periodShare(carData, monthKey, null, settings, car).gross - current.gross - pastGross
    lines.push({ label: driverLabel(car, link), note: outside > 0 ? `, 계약 밖 운송료 ${outside.toLocaleString('ko-KR')}원 제외` : '', share: current.share })
  } else {
    lines.push({ label: driverLabel(car, null), note: '', share: current.share - pastShare })
  }
  return lines
}

export function getMonthlyDriverRevenueShareExpense(monthKey: string, settings: FinanceSettings, subCars: Array<CarLike>, workDataByLogId: WorkDataByLogId = {}): { total: number, items: Array<{ date: string, label: string, amount: number }> } {
  const monthStart = `${monthKey}-01`
  const items: Array<{ date: string, label: string, amount: number }> = []
  let total = 0

  for (const car of subCars || []) {
    if (car.driverPayMode === 'salary') continue
    if (car.driverPayMode && car.driverPayMode !== 'revenue') continue

    for (const line of driverPayLines(monthKey, settings, car, workDataByLogId)) {
      if (line.share <= 0) continue
      items.push({ date: monthStart, label: `${line.label}${line.note}`, amount: line.share })
      total += line.share
    }
  }

  return { total, items: items.sort((a, b) => a.date.localeCompare(b.date)) }
}

export function getMonthlyDriverInsuranceOwnerShare(monthKey: string, settings: FinanceSettings, subCars: Array<CarLike>, workDataByLogId: WorkDataByLogId = {}): { total: number, items: Array<{ date: string, label: string, amount: number }> } {
  const monthStart = `${monthKey}-01`
  const items: Array<{ date: string, label: string, amount: number }> = []
  let total = 0

  for (const car of subCars || []) {
    if (car.driverPayMode && car.driverPayMode !== 'salary' && car.driverPayMode !== 'revenue') continue

    for (const line of driverPayLines(monthKey, settings, car, workDataByLogId)) {
      const amount = getDriverIncomeDeductions(car, getDriverSettlementAmount(car, line.share)).insuranceOwnerShare
      if (amount <= 0) continue
      items.push({ date: monthStart, label: `${line.label} 산재보험(차주 부담)`, amount })
      total += amount
    }
  }

  return { total, items: items.sort((a, b) => a.date.localeCompare(b.date)) }
}
