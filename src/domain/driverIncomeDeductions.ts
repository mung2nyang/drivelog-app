// 기사 정산액에서 산재보험료(월 단위)와 3.3% 원천징수를 계산한다. I/O 없음, 규칙 정본은 docs/roadmap.md 4-2.
// 기준 금액 = 기사 정산액(매출제: 기사 몫, 월급제: 월급). 월보수액 = 정산액 − 정산액 × 필요경비율.
import { parseCurrencyValue } from './money.ts'
import type { CarLike } from './financeTypes.ts'

export type DriverIncomeDraft = { driverIncomeType?: string, insuranceOn?: boolean, withholdingOn?: boolean, expenseRate?: string | number, insuranceRate?: string | number }
export type DriverIncomeFields = { driverIncomeType: 'employee' | 'business', insuranceOn: boolean, withholdingOn: boolean, expenseRate: string, insuranceRate: string }

export const DEFAULT_EXPENSE_RATE = '49.9'
export const DEFAULT_INSURANCE_RATE = '1.76'
const LEGACY_EXPENSE_RATE = 30.5
const LEGACY_INSURANCE_RATE = 1.8
const WITHHOLDING_RATE = 3.3

/** 새 기사차량 폼 기본값: 3.3% 사업소득자 → 산재·원천징수 둘 다 켬. */
export const NEW_DRIVER_INCOME_DRAFT: DriverIncomeFields = {
  driverIncomeType: 'business',
  insuranceOn: true,
  withholdingOn: true,
  expenseRate: DEFAULT_EXPENSE_RATE,
  insuranceRate: DEFAULT_INSURANCE_RATE,
}

/** 원 미만 버림. 소수 요율 곱셈의 부동소수점 오차(2501.9999…)로 1원 어긋나지 않게 보정한다. */
function floorWon(value: number) {
  return Math.floor(value + 1e-6)
}

/** 10원 미만 버림(근로복지공단 산재보험료 끝전 처리). */
function floorTen(value: number) {
  return Math.floor(value / 10 + 1e-6) * 10
}

/** 예전 기본값(30.5·1.8)으로 저장된 요율은 지금 기본값으로 읽는다. */
function currentRate(value: string | number | null | undefined, legacy: number, fallback: string) {
  return parseFloat(String(value ?? '')) === legacy ? fallback : value
}

function expenseRateOf(value: string | number | null | undefined) {
  return currentRate(value, LEGACY_EXPENSE_RATE, DEFAULT_EXPENSE_RATE)
}

function insuranceRateOf(value: string | number | null | undefined) {
  return currentRate(value, LEGACY_INSURANCE_RATE, DEFAULT_INSURANCE_RATE)
}

/** 빈 값·숫자 아님은 기본값, 범위는 0~100. 요율 0은 산재 적용 제외를 뜻한다. */
function rateOf(value: string | number | null | undefined, fallback: string) {
  const text = String(value ?? '').trim()
  const parsed = parseFloat(text === '' ? fallback : text)
  return Math.min(100, Math.max(0, Number.isFinite(parsed) ? parsed : parseFloat(fallback)))
}

/** 기사차량 폼 draft → 저장 필드(새 필드 4개 + 기존 insuranceOn). */
export function driverIncomeFieldsFromDraft(draft: DriverIncomeDraft): DriverIncomeFields {
  return {
    driverIncomeType: draft.driverIncomeType === 'employee' ? 'employee' : 'business',
    insuranceOn: !!draft.insuranceOn,
    withholdingOn: !!draft.withholdingOn,
    expenseRate: String(rateOf(draft.expenseRate, DEFAULT_EXPENSE_RATE)),
    insuranceRate: String(rateOf(draft.insuranceRate, DEFAULT_INSURANCE_RATE)),
  }
}

/** 저장된 차량 → 폼 draft. 미설정값은 기존 동작 유지(원천징수 꺼짐, 사업소득자), 요율만 기본값. */
export function driverIncomeDraftFromCar(car: CarLike): DriverIncomeFields {
  return {
    driverIncomeType: car.driverIncomeType === 'employee' ? 'employee' : 'business',
    insuranceOn: !!car.insuranceOn,
    withholdingOn: !!car.withholdingOn,
    expenseRate: String(expenseRateOf(car.expenseRate) ?? DEFAULT_EXPENSE_RATE),
    insuranceRate: String(insuranceRateOf(car.insuranceRate) ?? DEFAULT_INSURANCE_RATE),
  }
}

/** 기사 정산액 = 월급제는 월급, 매출제는 기사 몫(수수료 계산 결과). */
export function getDriverSettlementAmount(car: CarLike | null | undefined, commissionAmount: number) {
  return car?.driverPayMode === 'salary' ? parseCurrencyValue(car.driverSalaryAmount) : commissionAmount
}

/**
 * 산재보험료 총액·부담 나눔·3.3%·기사 실수령. 산재는 산재 적용 토글이 켜졌을 때만(꺼지면 총액 0),
 * 부담은 기사 유형이 정한다: 사업소득자 = 기사·차주가 각각 월보수액 × 요율의 절반(10원 미만 버림), 근로자 = 차주가 월보수액 × 요율.
 * 3.3%는 산재 공제 전 정산액 기준이며 원천징수 토글이 켜졌을 때만.
 */
export function getDriverIncomeDeductions(car: CarLike | null | undefined, settlementAmount: number) {
  const amount = Math.max(0, Math.floor(Number(settlementAmount) || 0))
  const insuranceBase = amount - floorWon(amount * rateOf(expenseRateOf(car?.expenseRate), DEFAULT_EXPENSE_RATE) / 100)
  const insuranceRate = car?.insuranceOn ? rateOf(insuranceRateOf(car?.insuranceRate), DEFAULT_INSURANCE_RATE) : 0
  const isEmployee = car?.driverIncomeType === 'employee'
  const insuranceDriverShare = isEmployee ? 0 : floorTen(insuranceBase * insuranceRate / 200)
  const insuranceOwnerShare = isEmployee ? floorTen(insuranceBase * insuranceRate / 100) : insuranceDriverShare
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

/** 기사 관리 정산 요약 카드용: 총 운송료·기사 정산금·산재(기사 몫)·원천징수·최종 실수령. */
export function getDriverSettlementBreakdown(
  detail: { totalFare?: number, commissionAmount?: number } | null | undefined,
  car: CarLike | null | undefined,
) {
  const settlementAmount = getDriverSettlementAmount(car, detail?.commissionAmount || 0)
  return { totalFare: detail?.totalFare || 0, ...getDriverIncomeDeductions(car, settlementAmount) }
}
