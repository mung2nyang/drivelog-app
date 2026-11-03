// 기사 정산 관련 월 지출 — 매출 손익 "기사 급여" 라인용. I/O 없음.
// getMonthlyDriverSalaryExpense와 반환 모양을 맞춘다.
import { getShortCarNum } from './cars.ts'
import { getDriverIncomeDeductions, getDriverSettlementAmount } from './driverIncomeDeductions.ts'
import {
  calculateDriverVehicleCommission,
  getDriverCarWorkData,
  getMonthlyDriverTotals,
} from './financeCore.ts'
import { driverShareBaseAmount, getMonthlyDriverClientCommission } from './driverShareBase.ts'
import type { CarLike, DriverLinkLike, FinanceSettings, WorkDataByLogId } from './financeTypes.ts'

// 기사 급여는 계약 기간 안만 센다. 해제된 예전 계약은 "이전 기사" 줄로, 겹친 날은 뒤 계약 몫.
function activeLinkForCar(links: Array<DriverLinkLike>, car: CarLike): DriverLinkLike | null {
  return links.find((item) => item.status === 'linked' && (item.id === car.driverLinkId || item.vehicleNumber === car.number)) || null
}

/** @param dateKey `YYYY-MM-DD` → `M/D` */
function shortDate(dateKey: string | undefined) {
  const [, m, d] = String(dateKey || '').split('-').map(Number)
  return m && d ? `${m}/${d}` : ''
}

/** @param dateKey `YYYY-MM-DD` → 하루 전 `YYYY-MM-DD` */
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

type DriverPayLine = { label: string, note: string, share: number }

/** 차량 하나의 기사 급여 줄들 — 이전 기사(시작일 순) 다음 지금 기사. */
function driverPayLines(monthKey: string, settings: FinanceSettings, car: CarLike, workDataByLogId: WorkDataByLogId): Array<DriverPayLine> {
  const links = Array.isArray(settings?.driverLinks) ? settings.driverLinks : []
  const link = activeLinkForCar(links, car)
  const carData = getDriverCarWorkData(car, workDataByLogId)
  const shareOf = (period: DriverLinkLike | null) => {
    const totals = getMonthlyDriverTotals(carData, monthKey, period, settings, car.number)
    const base = driverShareBaseAmount(car, totals.grossAmount, getMonthlyDriverClientCommission(carData, monthKey, period, settings, car.number))
    return { gross: totals.grossAmount, share: calculateDriverVehicleCommission(car, base) }
  }
  const current = shareOf(link)
  if (car.driverPayMode === 'salary') return [{ label: driverLabel(car, link), note: '', share: current.share }]

  const past = previousContracts(settings, car, link).map((period) => ({ period, ...shareOf(period) }))
  const lines: Array<DriverPayLine> = past.map(({ period, share }) => ({
    label: `이전 기사 (${shortDate(period.assignmentStart)}~${shortDate(period.assignmentEnd)})`,
    note: '',
    share,
  }))
  const pastGross = past.reduce((sum, item) => sum + item.gross, 0)
  const pastShare = past.reduce((sum, item) => sum + item.share, 0)
  if (link) {
    const outside = shareOf(null).gross - current.gross - pastGross
    lines.push({ label: driverLabel(car, link), note: outside > 0 ? `, 계약 밖 운송료 ${outside.toLocaleString('ko-KR')}원 제외` : '', share: current.share })
  } else {
    lines.push({ label: driverLabel(car, null), note: '', share: current.share - pastShare })
  }
  return lines
}

/**
 * 매출제 기사 월 정산액(기사 몫) — 기사 정산액 전체가 차주 지출이다. 산재 기사 몫·3.3%는 기사에게 줄 돈에서
 * 떼어 대신 내는 돈이라 지출이 아니고, 산재 차주 몫은 getMonthlyDriverInsuranceOwnerShare가 따로 더한다.
 */
export function getMonthlyDriverRevenueShareExpense(monthKey: string, settings: FinanceSettings, subCars: Array<CarLike>, workDataByLogId: WorkDataByLogId = {}): { total: number, items: Array<{ date: string, label: string, amount: number }> } {
  const monthStart = `${monthKey}-01`
  const items: Array<{ date: string, label: string, amount: number }> = []
  let total = 0

  for (const car of subCars || []) {
    // 월급제는 salary 함수가 담당. driverPayMode 미설정(레거시)은 매출제 기본값.
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

/** 산재보험료 차주 부담분(월) — 기사 정산액(매출제 몫·월급제 월급) 기준. 산재 적용 토글이 꺼진 차량은 총액 전부가 차주 몫이다. */
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
