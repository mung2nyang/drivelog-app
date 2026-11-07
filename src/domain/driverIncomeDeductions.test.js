// @ts-check
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  DEFAULT_EXPENSE_RATE, DEFAULT_INSURANCE_RATE, NEW_DRIVER_INCOME_DRAFT,
  driverIncomeDraftFromCar, driverIncomeFieldsFromDraft, getDriverIncomeDeductions,
  getDriverSettlementAmount, getDriverSettlementBreakdown, hasDriverInsuranceShare, insuranceSplitOf,
} from './driverIncomeDeductions.ts'
import { upsertCar } from './cars.ts'

/** @typedef {import('./financeTypes.ts').CarLike} CarLike */

/** 사업소득자(3.3%): 산재·원천징수 둘 다 켬 */
const BUSINESS_CAR = /** @type {CarLike} */ ({ number: '12가3456', driverIncomeType: 'business', insuranceOn: true, withholdingOn: true })
/** 4대보험 근로자: 산재 켬(차주 전액 부담)·원천징수 끔 */
const EMPLOYEE_CAR = /** @type {CarLike} */ ({ number: '12가3456', driverIncomeType: 'employee', insuranceOn: true, withholdingOn: false })

// 기본값 = 2026년 고시(화물차주 경비 공제율 49.9%, 산재보험료율 1.76%). 근거는 docs/industry-settlement-reference.md.
describe('getDriverIncomeDeductions — 확정 규칙 예시', () => {
  test('매출제 20%, 운송료 1,000,000 → 정산액 200,000, 사업소득자(둘 다 ON)', () => {
    // 월보수액 200,000 − 99,800 = 100,200 → 각자 100,200 × 0.88% = 881.76 → 880(10원 미만 버림), 3.3% 6,600
    assert.deepEqual(getDriverIncomeDeductions(BUSINESS_CAR, 200000), {
      settlementAmount: 200000,
      insuranceBase: 100200,
      insuranceTotal: 1760,
      insuranceDriverShare: 880,
      insuranceOwnerShare: 880,
      withholding: 6600,
      driverNet: 192520,
    })
  })

  test('월급제 2,000,000, 사업소득자(둘 다 ON)', () => {
    const result = getDriverIncomeDeductions(BUSINESS_CAR, 2000000)
    assert.equal(result.insuranceBase, 1002000)
    assert.equal(result.insuranceTotal, 17620)
    assert.equal(result.insuranceDriverShare, 8810)
    assert.equal(result.insuranceOwnerShare, 8810)
    assert.equal(result.withholding, 66000)
    assert.equal(result.driverNet, 1925190)
  })

  test('월급제 2,000,000, 4대보험 근로자(산재 ON·원천징수 OFF) — 산재 전부 차주 몫, 기사 공제 없음', () => {
    // 1,002,000 × 1.76% = 17,635.2 → 17,630
    const result = getDriverIncomeDeductions(EMPLOYEE_CAR, 2000000)
    assert.equal(result.insuranceTotal, 17630)
    assert.equal(result.insuranceDriverShare, 0)
    assert.equal(result.insuranceOwnerShare, 17630)
    assert.equal(result.withholding, 0)
    assert.equal(result.driverNet, 2000000)
  })
})

describe('getDriverIncomeDeductions — 토글·요율·경계', () => {
  test('산재만 켜면 3.3%는 없고, 산재를 끄면 산재보험료 자체가 없다(기사·차주 몫 모두 0)', () => {
    const onlyInsurance = getDriverIncomeDeductions({ ...BUSINESS_CAR, withholdingOn: false }, 200000)
    assert.equal(onlyInsurance.withholding, 0)
    assert.equal(onlyInsurance.driverNet, 200000 - 880)
    const onlyWithholding = getDriverIncomeDeductions({ ...BUSINESS_CAR, insuranceOn: false }, 200000)
    assert.equal(onlyWithholding.insuranceTotal, 0)
    assert.equal(onlyWithholding.insuranceDriverShare, 0)
    assert.equal(onlyWithholding.insuranceOwnerShare, 0)
    assert.equal(onlyWithholding.driverNet, 200000 - 6600)
  })

  test('3.3% 기준은 산재 공제 전 정산액이다(산재 몫을 뺀 금액이 아니다)', () => {
    assert.equal(getDriverIncomeDeductions(BUSINESS_CAR, 200000).withholding, Math.floor(200000 * 0.033))
  })

  test('사업소득자는 기사·차주 몫을 각자 계산해 10원 미만을 버리고, 총액은 두 몫의 합이다', () => {
    // 정산액 100,001: 월보수액 50,101 → 각자 50,101 × 0.88% = 440.88… → 440
    const result = getDriverIncomeDeductions(BUSINESS_CAR, 100001)
    assert.equal(result.insuranceDriverShare, 440)
    assert.equal(result.insuranceOwnerShare, 440)
    assert.equal(result.insuranceTotal, 880)
  })

  test('근로복지공단 계산 방식과 같다 — 사업소득 9,000,000원, 경비 30.3%면 월보수액 6,273,000원, 각자 55,200원', () => {
    // 6,273,000 × 1.76% ÷ 2 = 55,202.4 → 55,200
    const result = getDriverIncomeDeductions({ ...BUSINESS_CAR, expenseRate: '30.3' }, 9000000)
    assert.equal(result.insuranceBase, 6273000)
    assert.equal(result.insuranceDriverShare, 55200)
    assert.equal(result.insuranceOwnerShare, 55200)
  })

  test('산재요율 0은 산재 적용 제외 — 총액·기사 몫·차주 몫 모두 0', () => {
    const result = getDriverIncomeDeductions({ ...BUSINESS_CAR, insuranceRate: '0' }, 200000)
    assert.equal(result.insuranceTotal, 0)
    assert.equal(result.insuranceOwnerShare, 0)
    assert.equal(result.driverNet, 200000 - 6600)
  })

  test('필요경비율 43.1%(특수차량)와 직접 수정한 값이 월보수액에 반영된다', () => {
    assert.equal(getDriverIncomeDeductions({ ...BUSINESS_CAR, expenseRate: '43.1' }, 200000).insuranceBase, 200000 - 86200)
    assert.equal(getDriverIncomeDeductions({ ...BUSINESS_CAR, expenseRate: 50 }, 200000).insuranceBase, 100000)
  })

  test('요율이 비었거나 숫자가 아니면 기본값, 범위 밖은 0~100으로 맞춘다', () => {
    const base = getDriverIncomeDeductions(BUSINESS_CAR, 200000)
    assert.deepEqual(getDriverIncomeDeductions({ ...BUSINESS_CAR, expenseRate: '', insuranceRate: '가나다' }, 200000), base)
    assert.equal(getDriverIncomeDeductions({ ...BUSINESS_CAR, expenseRate: '150' }, 200000).insuranceBase, 0)
    assert.equal(getDriverIncomeDeductions({ ...BUSINESS_CAR, expenseRate: '-5' }, 200000).insuranceBase, 200000)
  })

  test('10원 미만은 버리되 소수 요율 곱셈 오차로 10원 어긋나지 않는다(90,000원의 0.7%는 정확히 630원)', () => {
    // 90000 * 0.7 / 100 은 부동소수점으로 629.99999…가 되어 그대로 버림하면 620원이 된다.
    const result = getDriverIncomeDeductions({ ...EMPLOYEE_CAR, expenseRate: '0', insuranceRate: '0.7' }, 90000)
    assert.equal(result.insuranceTotal, 630)
  })

  test('예전 기본값(30.5·1.8)으로 저장된 차량은 지금 기본값으로 계산한다', () => {
    const base = getDriverIncomeDeductions(BUSINESS_CAR, 200000)
    assert.deepEqual(getDriverIncomeDeductions({ ...BUSINESS_CAR, expenseRate: '30.5', insuranceRate: '1.8' }, 200000), base)
    assert.deepEqual(getDriverIncomeDeductions({ ...BUSINESS_CAR, expenseRate: 30.5, insuranceRate: 1.8 }, 200000), base)
    assert.equal(getDriverIncomeDeductions({ ...BUSINESS_CAR, expenseRate: '30.3' }, 200000).insuranceBase, 200000 - 60600)
  })

  test('정산액이 0·음수·숫자 아님이면 전부 0', () => {
    for (const amount of [0, -1000, NaN]) {
      const result = getDriverIncomeDeductions(BUSINESS_CAR, amount)
      assert.equal(result.settlementAmount, 0)
      assert.equal(result.insuranceTotal, 0)
      assert.equal(result.withholding, 0)
      assert.equal(result.driverNet, 0)
    }
  })

  test('차량이 없거나 설정이 비어 있으면 공제 없음(산재 꺼짐 = 산재보험료 0)', () => {
    const result = getDriverIncomeDeductions(null, 200000)
    assert.equal(result.insuranceDriverShare, 0)
    assert.equal(result.withholding, 0)
    assert.equal(result.insuranceTotal, 0)
    assert.equal(result.driverNet, 200000)
  })
})

describe('산재 부담 선택(차주 전액·반반·기사 전액)', () => {
  test('정산액 200,000(산재·3.3% 켬): 반반 880·880, 차주 전액 0·1,760, 기사 전액 1,760·0', () => {
    const pick = (/** @type {'owner'|'half'|'driver'} */ insuranceSplit) => {
      const r = getDriverIncomeDeductions({ ...BUSINESS_CAR, insuranceSplit }, 200000)
      return [r.insuranceDriverShare, r.insuranceOwnerShare, r.insuranceTotal, r.driverNet]
    }
    assert.deepEqual(pick('half'), [880, 880, 1760, 192520])
    assert.deepEqual(pick('owner'), [0, 1760, 1760, 193400])
    assert.deepEqual(pick('driver'), [1760, 0, 1760, 191640])
  })

  test('기사 유형과 상관없이 고른 산재 부담대로 계산한다 — 근로자여도 기사 전액이면 기사 몫이 빠진다', () => {
    const r = getDriverIncomeDeductions({ ...EMPLOYEE_CAR, insuranceSplit: 'driver' }, 2000000)
    assert.equal(r.insuranceDriverShare, 17630)
    assert.equal(r.insuranceOwnerShare, 0)
    assert.equal(r.driverNet, 2000000 - 17630)
  })

  test('산재 부담 값이 없거나 이상하면 기사 유형으로 정한다(근로자 = 차주 전액, 사업소득자 = 반반)', () => {
    assert.equal(insuranceSplitOf({ driverIncomeType: 'employee' }), 'owner')
    assert.equal(insuranceSplitOf({ driverIncomeType: 'business' }), 'half')
    assert.equal(insuranceSplitOf({}), 'half')
    assert.equal(insuranceSplitOf(null), 'half')
    assert.equal(insuranceSplitOf({ driverIncomeType: 'employee', insuranceSplit: 'x' }), 'owner')
    assert.equal(insuranceSplitOf({ driverIncomeType: 'employee', insuranceSplit: 'driver' }), 'driver')
  })

  test('산재 기사 몫 줄은 산재를 켜고 차주 전액이 아닐 때만', () => {
    assert.equal(hasDriverInsuranceShare(BUSINESS_CAR), true)
    assert.equal(hasDriverInsuranceShare(EMPLOYEE_CAR), false)
    assert.equal(hasDriverInsuranceShare({ ...EMPLOYEE_CAR, insuranceSplit: 'driver' }), true)
    assert.equal(hasDriverInsuranceShare({ ...BUSINESS_CAR, insuranceSplit: 'owner' }), false)
    assert.equal(hasDriverInsuranceShare({ ...BUSINESS_CAR, insuranceOn: false }), false)
    assert.equal(hasDriverInsuranceShare(undefined), false)
  })
})

describe('정산액·정산 요약', () => {
  test('월급제는 월급, 매출제는 기사 몫(수수료 계산 결과)이 정산액이다', () => {
    assert.equal(getDriverSettlementAmount({ number: 'a', driverPayMode: 'salary', driverSalaryAmount: '2,000,000' }, 999), 2000000)
    assert.equal(getDriverSettlementAmount({ number: 'a', driverPayMode: 'revenue' }, 200000), 200000)
    assert.equal(getDriverSettlementAmount({ number: 'a' }, 150000), 150000, '미설정(레거시)은 매출제')
  })

  test('정산 요약: 총 운송료·기사 정산금·산재(기사 몫)·원천징수·최종 실수령', () => {
    const detail = { totalFare: 1000000, commissionAmount: 200000 }
    const result = getDriverSettlementBreakdown(detail, { ...BUSINESS_CAR, driverPayMode: 'revenue' })
    assert.equal(result.totalFare, 1000000)
    assert.equal(result.settlementAmount, 200000)
    assert.equal(result.insuranceDriverShare, 880)
    assert.equal(result.withholding, 6600)
    assert.equal(result.driverNet, 192520)
  })

  test('정산 요약: 월급제는 운송료와 무관하게 월급 기준이다', () => {
    const result = getDriverSettlementBreakdown({ totalFare: 500000, commissionAmount: 0 }, { ...BUSINESS_CAR, driverPayMode: 'salary', driverSalaryAmount: '2000000' })
    assert.equal(result.settlementAmount, 2000000)
    assert.equal(result.driverNet, 1925190)
  })

  test('정산 요약: detail이 없어도 0으로 안전하다', () => {
    const result = getDriverSettlementBreakdown(null, undefined)
    assert.equal(result.totalFare, 0)
    assert.equal(result.driverNet, 0)
  })
})

describe('차량 폼 draft ↔ 저장 필드', () => {
  test('새 차량 폼 기본값은 사업소득자 + 산재·원천징수 ON, 경비율 49.9·요율 1.76', () => {
    assert.deepEqual(NEW_DRIVER_INCOME_DRAFT, {
      driverIncomeType: 'business', insuranceOn: true, withholdingOn: true,
      expenseRate: DEFAULT_EXPENSE_RATE, insuranceRate: DEFAULT_INSURANCE_RATE, insuranceSplit: 'half',
    })
    assert.equal(DEFAULT_EXPENSE_RATE, '49.9')
    assert.equal(DEFAULT_INSURANCE_RATE, '1.76')
  })

  test('driverIncomeFieldsFromDraft: 빈 요율은 기본값, 이상한 유형은 사업소득자, 숫자 문자열로 정리', () => {
    assert.deepEqual(driverIncomeFieldsFromDraft({ driverIncomeType: '?', expenseRate: '', insuranceRate: '2.00' }), {
      driverIncomeType: 'business', insuranceOn: false, withholdingOn: false, expenseRate: '49.9', insuranceRate: '2', insuranceSplit: 'half',
    })
    assert.equal(driverIncomeFieldsFromDraft({ driverIncomeType: 'employee' }).driverIncomeType, 'employee')
    assert.equal(driverIncomeFieldsFromDraft({ driverIncomeType: 'employee' }).insuranceSplit, 'owner')
    assert.equal(driverIncomeFieldsFromDraft({ driverIncomeType: 'employee', insuranceSplit: 'driver' }).insuranceSplit, 'driver')
  })

  test('driverIncomeDraftFromCar: 새 필드가 없는 기존 차량은 원천징수 꺼짐·사업소득자·기본 요율(기존 동작 유지)', () => {
    assert.deepEqual(driverIncomeDraftFromCar({ number: 'a', insuranceOn: true }), {
      driverIncomeType: 'business', insuranceOn: true, withholdingOn: false, expenseRate: '49.9', insuranceRate: '1.76', insuranceSplit: 'half',
    })
    assert.deepEqual(driverIncomeDraftFromCar({ number: 'a', driverIncomeType: 'employee', withholdingOn: true, expenseRate: 43.1, insuranceRate: '0' }), {
      driverIncomeType: 'employee', insuranceOn: false, withholdingOn: true, expenseRate: '43.1', insuranceRate: '0', insuranceSplit: 'owner',
    })
  })

  test('driverIncomeDraftFromCar: 예전 기본값(30.5·1.8)으로 저장된 차량은 폼에 지금 기본값으로 보인다', () => {
    const draft = driverIncomeDraftFromCar({ number: 'a', insuranceOn: true, expenseRate: '30.5', insuranceRate: 1.8 })
    assert.equal(draft.expenseRate, '49.9')
    assert.equal(draft.insuranceRate, '1.76')
  })

  test('upsertCar: 기사차량은 새 필드를 저장하고 메인 차량에는 붙이지 않는다', () => {
    const sub = upsertCar([], {
      number: '12가3456', type: 'sub', driverPayMode: 'revenue', commission: '20',
      driverIncomeType: 'employee', insuranceOn: false, withholdingOn: false, expenseRate: '43.1', insuranceRate: '2',
    }).cars?.[0]
    assert.equal(sub?.driverIncomeType, 'employee')
    assert.equal(sub?.withholdingOn, false)
    assert.equal(sub?.expenseRate, '43.1')
    assert.equal(sub?.insuranceRate, '2')
    assert.equal(sub?.insuranceSplit, 'owner')
    assert.equal(upsertCar([], { number: '12가3457', type: 'sub', commission: '20', insuranceSplit: 'driver' }).cars?.[0]?.insuranceSplit, 'driver')
    const main = upsertCar([], { number: '99가9999', type: 'main', driverIncomeType: 'employee', withholdingOn: true, expenseRate: '43.1' }).cars?.[0]
    assert.equal(main?.type, 'main')
    for (const key of ['driverIncomeType', 'withholdingOn', 'expenseRate', 'insuranceRate', 'insuranceSplit']) {
      assert.equal(key in (main || {}), false, `메인 차량에 ${key}가 저장되면 안 된다`)
    }
    assert.equal(main?.insuranceOn, false)
  })
})
