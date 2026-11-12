// @ts-check
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { getDriverSelfMonthlyDetail } from './driverSelfRevenue.ts'
import { getOwnerMonthlyFinanceDetail } from './financeOwnerDetail.ts'
import { getMonthlyDriverTotals } from './financeCore.ts'
import { FIXTURE_SETTINGS, FIXTURE_WORK, MONTH_KEY } from './finance.fixtures.ts'

/** @typedef {import('./financeTypes.ts').CarLike} CarLike */
/** @typedef {import('./financeTypes.ts').FinanceSettings} FinanceSettings */
/** @typedef {import('./financeTypes.ts').DriverLinkLike} DriverLinkLike */

const REVENUE_CAR = /** @type {CarLike} */ (FIXTURE_SETTINGS.cars.find((c) => c.number === '서울12가3456'))
const SALARY_CAR = /** @type {CarLike} */ (FIXTURE_SETTINGS.cars.find((c) => c.number === '부산33나1111'))
const MAIN_ONLY_WORK = { main: FIXTURE_WORK['서울12가3456'] }

const FARE_TOTAL = 450000
const TRIP_COUNT = 2
const SHARE_GROSS = 67500
const SHARE_NET = 67210
const SALARY = 2000000

/**
 * @param {Array<CarLike>} cars
 * @param {Array<DriverLinkLike>} [driverLinks]
 * @returns {FinanceSettings}
 */
function settingsWithCars(cars, driverLinks = FIXTURE_SETTINGS.driverLinks) {
  return {
    ...FIXTURE_SETTINGS,
    driverLinks,
    cars: [
      /** @type {CarLike} */ ({ type: 'main', number: '서울00가0000' }),
      ...cars,
    ],
  }
}

describe('getDriverSelfMonthlyDetail — main 키 전제 (§6)', () => {
  test('(b) {main: 트립} 입력 직후와 동일 — 순이익 = 배정기간 내 운송료 × % − 산재 기사 몫', () => {
    const detail = getDriverSelfMonthlyDetail(MONTH_KEY, settingsWithCars([REVENUE_CAR]), MAIN_ONLY_WORK)
    assert.equal(detail.income.fare.total, FARE_TOTAL)
    assert.equal(detail.tripCount, TRIP_COUNT)
    assert.equal(detail.income.settlement.total, SHARE_NET)
    assert.equal(detail.netProfit, SHARE_NET)
    assert.equal(detail.income.insurance.total, 3000, '콜 상세 산재보험료 3,000원(로드맵 40)')
    assert.equal(
      detail.income.total,
      detail.income.fare.total - detail.income.commission.total - detail.income.insurance.total,
      '합계는 화면에 보이는 운송료−수수료−산재보험료',
    )
    assert.notEqual(detail.income.total, detail.netProfit, '합계와 정산액(순이익)은 다른 값')
    assert.equal(detail.income.settlement.label, '기사 정산(15%)')
  })

  test('번호판 키만 있고 main 비면 운송료·정산 0 (키 미통일 회귀 방지)', () => {
    const detail = getDriverSelfMonthlyDetail(
      MONTH_KEY,
      settingsWithCars([REVENUE_CAR]),
      { '서울12가3456': FIXTURE_WORK['서울12가3456'] },
    )
    assert.equal(detail.income.fare.total, 0)
    assert.equal(detail.netProfit, 0)
  })

  test('(c) insuranceOn이면 산재 차감 (totals link 필터, totals 기준 commission)', () => {
    const withIns = getDriverSelfMonthlyDetail(MONTH_KEY, settingsWithCars([REVENUE_CAR]), MAIN_ONLY_WORK)
    const withoutIns = getDriverSelfMonthlyDetail(
      MONTH_KEY,
      settingsWithCars([{ ...REVENUE_CAR, insuranceOn: false }]),
      MAIN_ONLY_WORK,
    )
    assert.equal(withIns.netProfit, SHARE_NET)
    assert.equal(withoutIns.netProfit, SHARE_GROSS)
    assert.equal(withIns.netProfit + 290, withoutIns.netProfit, '산재 기사 몫 290원만큼 차이')
  })

  test('(c-2) withholdingOn이면 3.3% 원천징수도 함께 차감된다(산재 공제 전 정산액 기준)', () => {
    const withWithholding = getDriverSelfMonthlyDetail(MONTH_KEY, settingsWithCars([{ ...REVENUE_CAR, withholdingOn: true }]), MAIN_ONLY_WORK)
    assert.equal(withWithholding.netProfit, SHARE_NET - 2227)
  })

  test('(d) 월급제 — 고정급, 라벨 기사 정산(월급)', () => {
    const detail = getDriverSelfMonthlyDetail(
      MONTH_KEY,
      settingsWithCars([SALARY_CAR]),
      { main: FIXTURE_WORK['부산33나1111'] },
    )
    assert.equal(detail.netProfit, SALARY)
    assert.equal(detail.income.settlement.total, SALARY)
    assert.equal(detail.income.settlement.label, '기사 정산(월급)')
  })

  test('expense.total === 0 (expenses 없을 때)', () => {
    const detail = getDriverSelfMonthlyDetail(MONTH_KEY, settingsWithCars([REVENUE_CAR]), MAIN_ONLY_WORK)
    assert.equal(detail.expense.total, 0)
    assert.equal(detail.expense.salary.total, 0)
  })

  test('배정차 0대 → 정산 0 가드', () => {
    const detail = getDriverSelfMonthlyDetail(MONTH_KEY, { ...FIXTURE_SETTINGS, cars: [] }, MAIN_ONLY_WORK)
    assert.equal(detail.netProfit, 0)
    assert.equal(detail.income.settlement.total, 0)
    assert.equal(detail.income.settlement.label, '기사 정산')
  })

  test('차주 몫이 settlement 라인에 안 들어감', () => {
    const detail = getDriverSelfMonthlyDetail(MONTH_KEY, settingsWithCars([REVENUE_CAR]), MAIN_ONLY_WORK)
    const ownerShare = FARE_TOTAL - SHARE_NET
    assert.ok(ownerShare > 0)
    assert.ok(!detail.income.settlement.items.some((i) => i.amount === ownerShare))
    assert.equal(detail.income.total, detail.income.fare.total - detail.income.commission.total - detail.income.insurance.total)
    assert.equal(detail.income.settlement.total, SHARE_NET)
  })

  test('지출이 있어도 netProfit은 정산액 유지(Q1)', () => {
    /** @type {Array<import('./expenseTypes.ts').ExpenseItem>} */
    const expenses = [
      { id: 'maint-1', kind: 'maint', date: '2026-05-12', name: '오일', cost: 50000 },
      { id: 'fuel-1', kind: 'fuel', date: '2026-05-12', fuelType: '주유', cost: 80000, subsidy: 0, liters: 40 },
    ]
    const without = getDriverSelfMonthlyDetail(MONTH_KEY, settingsWithCars([REVENUE_CAR]), MAIN_ONLY_WORK, [])
    const withExp = getDriverSelfMonthlyDetail(MONTH_KEY, settingsWithCars([REVENUE_CAR]), MAIN_ONLY_WORK, expenses)
    assert.equal(withExp.netProfit, SHARE_NET)
    assert.equal(withExp.netProfit, without.netProfit)
    assert.equal(withExp.income.total, withExp.income.fare.total - withExp.income.commission.total - withExp.income.insurance.total)
    assert.ok(withExp.expense.total > 0)
    assert.equal(withExp.expense.maint.total, 50000)
    assert.equal(withExp.expense.fuel.total, 80000)
  })

  test('① 배정기간 밖 트립은 정산액에서 제외된다', () => {
    const car = /** @type {CarLike} */ ({ ...REVENUE_CAR, insuranceOn: false })
    /** @type {import('./financeTypes.ts').WorkDataByLogId} */
    const work = {
      main: {
        '2026-05-10': {
          callDetails: [{ id: 'in-range', client: '대한', fare: 100000 }],
        },
        '2026-05-25': {
          callDetails: [{ id: 'out-of-range', client: '대한', fare: 100000 }],
        },
      },
    }
    const narrowLinks = /** @type {Array<DriverLinkLike>} */ ([{
      id: 'link-narrow',
      vehicleNumber: '서울12가3456',
      assignmentStart: '2026-05-01',
      assignmentEnd: '2026-05-15',
      status: 'linked',
    }])
    const fullLinks = /** @type {Array<DriverLinkLike>} */ ([{
      id: 'link-full',
      vehicleNumber: '서울12가3456',
      assignmentStart: '2026-05-01',
      assignmentEnd: '2026-05-31',
      status: 'linked',
    }])
    const narrow = getDriverSelfMonthlyDetail(MONTH_KEY, settingsWithCars([car], narrowLinks), work)
    const full = getDriverSelfMonthlyDetail(MONTH_KEY, settingsWithCars([car], fullLinks), work)
    assert.equal(narrow.netProfit, 15000, '배정기간 안 100,000 × 15%')
    assert.equal(full.netProfit, 30000, '월 전체 200,000 × 15%')
    assert.ok(narrow.netProfit < full.netProfit)
    assert.equal(narrow.income.fare.total, 200000, '운송료 표시 라인은 배정기간 필터 안 함')
  })

  test('② settlement == 차주 all 탭 김기사 급여 항목 (같은 트립·main↔번호판, 산재 ON)', () => {
    const plateWork = FIXTURE_WORK['서울12가3456']
    const settings = settingsWithCars([REVENUE_CAR])
    const self = getDriverSelfMonthlyDetail(MONTH_KEY, settings, { main: plateWork })
    const ownerAll = getOwnerMonthlyFinanceDetail(
      MONTH_KEY,
      'all',
      settings,
      { main: {}, '서울12가3456': plateWork },
      [],
    )
    const ownerKim = ownerAll.expense.salary.items.find((item) => item.label === '김기사 (5/1~5/31)')
    assert.equal(self.income.settlement.total, SHARE_NET)
    assert.equal(ownerKim?.amount, SHARE_GROSS, '차주 손익의 기사 급여는 산재를 빼지 않은 정산액 전체')
    assert.equal(self.income.settlement.total, SHARE_GROSS - 290, '기사 본인 실수령 = 정산액 − 산재 기사 몫')
  })

  test('③ 고정노선만 뛴 기사도 정산액이 0이 아니다(실제 저장 모양, fare 필드 없음)', () => {
    const settings = settingsWithCars([REVENUE_CAR])
    const realisticFixedOnly = { main: { '2026-05-12': { isOff: false, fixedCount: 1 } } }
    const detail = getDriverSelfMonthlyDetail(MONTH_KEY, settings, realisticFixedOnly)
    assert.equal(detail.netProfit, 37340, 'fixedUnitPrice(250,000) × 15% = 37,500 − 산재 기사 몫 160')
    assert.equal(detail.income.settlement.label, '기사 정산(15%)')
  })
})

describe('getDriverSelfMonthlyDetail — 배정 차량 스코프 고정노선', () => {
  const scopedClient = { id: 'c-sub', companyName: '기사고정', fixedRouteLinked: true, fixedUnitPrice: '100,000', scopedToVehicleNumber: '서울12가3456' }
  const realisticFixedOnly = { main: { '2026-05-12': { isOff: false, fixedCount: 1 } } }
  /** @param {Array<import('./clientTypes.ts').ClientLike>} clients */
  const settingsWithClients = (clients) => ({ ...settingsWithCars([REVENUE_CAR]), clients })

  test('스코프 거래처만 있어도(기사 세션 모양) 운송료가 본인 단가 100,000이고 정산 계산의 총매출과 같다', () => {
    const settings = settingsWithClients([scopedClient])
    const detail = getDriverSelfMonthlyDetail(MONTH_KEY, settings, realisticFixedOnly)
    const totals = getMonthlyDriverTotals(realisticFixedOnly.main, MONTH_KEY, FIXTURE_SETTINGS.driverLinks[0], settings)
    assert.equal(detail.income.fare.total, 100000)
    assert.equal(detail.income.fare.total, totals.grossAmount, '운송료와 정산 총매출이 어긋나면 안 된다')
    assert.equal(detail.income.fare.items[0]?.label, '기사고정')
  })

  test('스코프 거래처와 차주(스코프 없는) 거래처가 함께 있으면 본인 스코프가 우선한다', () => {
    const owner = { id: 'c-owner', companyName: '차주고정', fixedRouteLinked: true, fixedUnitPrice: '250,000' }
    const detail = getDriverSelfMonthlyDetail(MONTH_KEY, settingsWithClients([owner, scopedClient]), realisticFixedOnly)
    assert.equal(detail.income.fare.total, 100000)
  })

  test('스코프 거래처가 없으면 예전처럼 스코프 없는 고정노선(250,000)으로 계산된다(하위호환)', () => {
    const detail = getDriverSelfMonthlyDetail(MONTH_KEY, settingsWithCars([REVENUE_CAR]), realisticFixedOnly)
    assert.equal(detail.income.fare.total, 250000)
  })
})

test('공제 줄용 breakdown: 기사 몫·산재(기사 부담)·원천징수, 실수령 = 몫 − 공제(로드맵 45)', () => {
  const detail = getDriverSelfMonthlyDetail(MONTH_KEY, settingsWithCars([REVENUE_CAR]), MAIN_ONLY_WORK)
  const breakdown = detail.income.settlement.breakdown
  assert.ok(breakdown)
  assert.equal(breakdown.amount, SHARE_GROSS)
  assert.equal(breakdown.insurance, SHARE_GROSS - SHARE_NET)
  assert.equal(breakdown.showInsurance, true)
  assert.equal(breakdown.showWithholding, !!REVENUE_CAR.withholdingOn)
  assert.equal(breakdown.amount - breakdown.insurance - breakdown.withholding, detail.income.settlement.total)
})


test('산재 부담 선택이 기사 본인 화면에도 그대로: 기사 전액이면 기사 몫 590원, 차주 전액이면 산재 줄 없음', () => {
  const driverPays = getDriverSelfMonthlyDetail(MONTH_KEY, settingsWithCars([{ ...REVENUE_CAR, insuranceSplit: 'driver' }]), MAIN_ONLY_WORK).income.settlement.breakdown
  assert.equal(driverPays?.insurance, 590)
  assert.equal(driverPays?.showInsurance, true)
  const ownerPays = getDriverSelfMonthlyDetail(MONTH_KEY, settingsWithCars([{ ...REVENUE_CAR, insuranceSplit: 'owner' }]), MAIN_ONLY_WORK).income.settlement.breakdown
  assert.equal(ownerPays?.insurance, 0)
  assert.equal(ownerPays?.showInsurance, false)
})
