import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { buildCalendarCells, getYearOptions } from '../../../domain/calendar.ts'
import { searchParamsForViewDate, viewDateFromSearchParams } from '../../../domain/calendarViewDate.ts'
import { monthCallUnpaidTotal } from '../../../domain/day-record.ts'
import { resolveLogSettings } from '../../../domain/carSettingsScope.ts'
import CalendarHeader from './CalendarHeader.tsx'
import CalendarGrid from './CalendarGrid.tsx'
import CalendarMonthSummary from './CalendarMonthSummary.tsx'
import CalendarSubLogBanner from './CalendarSubLogBanner.tsx'
import useMonthSettlement from '../../../data/store/useMonthSettlement.ts'
import { recallViewMonth, rememberViewMonth } from '../../../data/store/viewMonthMemory.ts'
import './calendar-grid.css'
import './calendar.css'
import { useSession } from '../../../data/cloud/sessionContext.ts'

const YEAR_OPTIONS = getYearOptions()

type CalendarPageProps = {
  logId?: string
  clientScopeKey?: string
  userName?: string
  onOpenMenu?: (() => void)
  onBackToAuth?: (() => void)
  onSelectDay: (sel: { dateKey: string, month: number, day: number }) => void
}

export default function CalendarPage({
  logId = 'main', clientScopeKey, userName: _userName, onOpenMenu, onBackToAuth: _onBackToAuth, onSelectDay,
}: CalendarPageProps) {
  const { ownerKey } = useSession()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const viewDate = useMemo(() => (searchParams.has('y') || searchParams.has('m')
    ? viewDateFromSearchParams(searchParams)
    : recallViewMonth('calendar', ownerKey)?.viewDate ?? new Date()), [searchParams, ownerKey])
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const isMain = logId === 'main'
  useEffect(() => { rememberViewMonth('calendar', ownerKey, new Date(year, month, 1)) }, [ownerKey, year, month])

  const { workData, settings, inputMode, unitPrice, palletPrice, expenses, summary } = useMonthSettlement({
    ownerKey, logId, clientScopeKey, year, month,
  })
  const paymentOn = isMain ? !!settings.paymentOn : !!settings.subPaymentOn
  const distanceOn = !!resolveLogSettings(settings, logId).distanceOn

  const cells = useMemo(() => buildCalendarCells(viewDate), [viewDate])
  const unpaidTotal = useMemo(() => monthCallUnpaidTotal(workData, year, month), [workData, year, month])

  function changeMonth(nextYear: number, nextMonth: number) {
    setSearchParams(searchParamsForViewDate(new Date(nextYear, nextMonth, 1)), { replace: true })
  }

  return (
    <div className="page main-page">
      <CalendarHeader
        year={year}
        month={month}
        yearOptions={YEAR_OPTIONS}
        onChangeMonth={changeMonth}
        onOpenMenu={onOpenMenu}
        banner={!isMain && (
          <CalendarSubLogBanner logId={logId} onBackToMain={() => navigate('/app/calendar')} />
        )}
      />

      <CalendarGrid
        cells={cells}
        month={month + 1}
        workData={workData}
        inputMode={inputMode}
        unitPrice={unitPrice}
        palletPrice={palletPrice}
        paymentOn={paymentOn}
        expenses={expenses}
        expenseVehicle={isMain ? undefined : logId}
        onSelectDay={onSelectDay}
      />

      <CalendarMonthSummary
        paymentOn={paymentOn}
        unpaidTotal={unpaidTotal}
        summary={summary}
        distanceOn={distanceOn}
      />
    </div>
  )
}
