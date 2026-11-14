import { useEffect, useMemo, useState } from 'react'
import { shiftMonth } from '../../../domain/calendar.ts'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import { recallViewMonth, rememberViewMonth } from '../../../data/store/viewMonthMemory.ts'
import { buildFinanceSettings } from '../../../data/sync/ownerFinance.ts'
import { useOwnerCars, useOwnerDriverHistory, useOwnerDrivers, useOwnerProfile, useOwnerSettings } from '../../../data/store/ownerDataHooks.ts'
import { monthKeyOf } from './revenueFormat.ts'

export function useRevenuePeriod() {
  const { ownerKey } = useSession()
  const [tab, setTab] = useState(() => (recallViewMonth('revenue', ownerKey)?.yearly ? 'yearly' : 'monthly'))
  const [viewDate, setViewDate] = useState(() => recallViewMonth('revenue', ownerKey)?.viewDate ?? new Date())
  const yearly = tab === 'yearly'
  useEffect(() => { rememberViewMonth('revenue', ownerKey, viewDate, yearly) }, [ownerKey, viewDate, yearly])

  function shift(delta: number) {
    setViewDate((date) => (yearly ? new Date(date.getFullYear() + delta, date.getMonth(), 1) : shiftMonth(date, delta)))
  }

  return { tab, setTab, yearly, viewDate, setViewDate, year: viewDate.getFullYear(), month: viewDate.getMonth(), shift }
}

export function useRevenueFinanceSettings(ownerKey: string) {
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

export function buildYearlyRows(year: number, detailFor: (monthKey: string) => { netProfit: number }): Array<{ month: number, netProfit: number }> {
  return Array.from({ length: 12 }, (_, m) => ({ month: m + 1, netProfit: detailFor(monthKeyOf(year, m)).netProfit }))
}
