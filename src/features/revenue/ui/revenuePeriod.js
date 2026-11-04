// @ts-check
// 차주·연동 기사 매출 화면이 같이 쓰는 것: 보는 달·탭과 이동, 계산 설정 준비, 12달 순이익 줄.
import { useEffect, useMemo, useState } from 'react'
import { shiftMonth } from '../../../domain/calendar.ts'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import { recallViewMonth, rememberViewMonth } from '../../../data/store/viewMonthMemory.ts'
import { buildFinanceSettings } from '../../../data/sync/ownerFinance.ts'
import { useOwnerCars, useOwnerDriverHistory, useOwnerDrivers, useOwnerProfile, useOwnerSettings } from '../../../data/store/ownerDataHooks.ts'
import { monthKeyOf } from './revenueFormat.js'

/** 년 매출이면 1년, 월 매출이면 1달씩 옮긴다. 보던 달·탭은 앱이 켜진 동안 기억한다. */
export function useRevenuePeriod() {
  const { ownerKey } = useSession()
  const [tab, setTab] = useState(() => (recallViewMonth('revenue', ownerKey)?.yearly ? 'yearly' : 'monthly'))
  const [viewDate, setViewDate] = useState(() => recallViewMonth('revenue', ownerKey)?.viewDate ?? new Date())
  const yearly = tab === 'yearly'
  useEffect(() => { rememberViewMonth('revenue', ownerKey, viewDate, yearly) }, [ownerKey, viewDate, yearly])

  /** @param {number} delta */
  function shift(delta) {
    setViewDate((date) => (yearly ? new Date(date.getFullYear() + delta, date.getMonth(), 1) : shiftMonth(date, delta)))
  }

  return { tab, setTab, yearly, viewDate, setViewDate, year: viewDate.getFullYear(), month: viewDate.getMonth(), shift }
}

/** 차량·설정·개인정보·기사가 바뀌면 계산 설정을 다시 만든다. @param {string} ownerKey */
export function useRevenueFinanceSettings(ownerKey) {
  const cars = useOwnerCars(ownerKey)
  const practiceSettings = useOwnerSettings(ownerKey)
  const profile = useOwnerProfile(ownerKey)
  const drivers = useOwnerDrivers(ownerKey)
  const driverHistory = useOwnerDriverHistory(ownerKey)
  return useMemo(() => {
    void cars
    void practiceSettings
    void profile
    void drivers
    void driverHistory
    return buildFinanceSettings(ownerKey)
  }, [ownerKey, cars, practiceSettings, profile, drivers, driverHistory])
}

/**
 * @param {number} year
 * @param {(monthKey: string) => { netProfit: number }} detailFor
 * @returns {Array<{ month: number, netProfit: number }>}
 */
export function buildYearlyRows(year, detailFor) {
  return Array.from({ length: 12 }, (_, m) => ({ month: m + 1, netProfit: detailFor(monthKeyOf(year, m)).netProfit }))
}
