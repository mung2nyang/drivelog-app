// @ts-check
import { useMemo } from 'react'
import { getDriverSelfMonthlyDetail } from '../../../domain/driverSelfRevenue.ts'
import { useOwnerExpenses, useOwnerWorkDataByLogId } from '../../../data/store/ownerDataHooks.ts'
import OwnerMonthlyCards from './OwnerMonthlyCards.jsx'
import { RevenuePeriodBar, RevenueYearList } from './RevenuePeriodParts.jsx'
import { buildYearlyRows, useRevenueFinanceSettings, useRevenuePeriod } from './revenuePeriod.js'
import { monthKeyOf } from './revenueFormat.js'
import { useSession } from '../../../data/cloud/sessionContext.ts'

export default function DriverRevenueView() {
  const { ownerKey } = useSession()
  const period = useRevenuePeriod()
  const { year, month, yearly } = period
  const settings = useRevenueFinanceSettings(ownerKey)
  const workDataByLogId = useOwnerWorkDataByLogId(ownerKey)
  const expenses = useOwnerExpenses(ownerKey)

  const monthly = useMemo(
    () => getDriverSelfMonthlyDetail(monthKeyOf(year, month), settings, workDataByLogId, expenses),
    [year, month, settings, workDataByLogId, expenses],
  )
  const yearlyRows = useMemo(
    () => buildYearlyRows(year, (monthKey) => getDriverSelfMonthlyDetail(monthKey, settings, workDataByLogId, expenses)),
    [year, settings, workDataByLogId, expenses],
  )

  return (
    <>
      <RevenuePeriodBar period={period} />
      {!yearly && <OwnerMonthlyCards key={`${year}-${month}`} detail={monthly} variant="driverSelf" />}
      {yearly && <RevenueYearList year={year} rows={yearlyRows} />}
    </>
  )
}
