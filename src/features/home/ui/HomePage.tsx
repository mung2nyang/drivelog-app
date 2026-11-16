import { resolveLogSettings } from '../../../domain/carSettingsScope.ts'
import { todayWorkLogSelection } from '../../../domain/calendar.ts'
import { isOffDay } from '../../../domain/day-record.ts'
import { useOwnerCars } from '../../../data/store/ownerDataHooks.ts'
import useMonthSettlement from '../../../data/store/useMonthSettlement.ts'
import AppTopBar from '../../../shared/ui/AppTopBar.tsx'
import { useReceivablesData } from '../../receivables/hooks/useReceivablesData.ts'
import HomeAssistantBar from './HomeAssistantBar.tsx'
import HomeMonthCard from './HomeMonthCard.tsx'
import HomeTodayCard from './HomeTodayCard.tsx'
import HomeTodoCard from './HomeTodoCard.tsx'
import useTodayInspectionMissing from '../hooks/useTodayInspectionMissing.ts'
import './home.css'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import type { UnpaidRow } from './HomeTodoCard.tsx'

function unpaidRowsByCar(items: Array<{ logId: string, logLabel: string, remainingAmount: number }>, byCar: boolean): Array<UnpaidRow> {
  const rows: Map<string, UnpaidRow> = new Map()
  items.forEach((item) => {
    const key = byCar ? item.logId : 'all'
    const row = rows.get(key) || { key, label: byCar ? item.logLabel : '', main: item.logId === 'main', count: 0, total: 0 }
    row.count += 1
    row.total += item.remainingAmount
    rows.set(key, row)
  })
  return [...rows.values()]
}

type HomePageProps = {
  notifCount?: number
  onOpenMenu?: (() => void)
  onOpenNotifs?: (() => void)
  onOpenToday: (dateKey: string) => void
  onOpenReceivables: () => void
  onOpenCalendar: () => void
}

export default function HomePage({
  notifCount = 0, onOpenMenu, onOpenNotifs, onOpenToday, onOpenReceivables, onOpenCalendar,
}: HomePageProps) {
  const { ownerKey, session } = useSession()
  const cars = useOwnerCars(ownerKey)
  const clientScopeKey = session?.linkedOwnerId ? (cars[0]?.number || 'main') : 'main'
  const now = new Date()
  const today = todayWorkLogSelection(now)
  const { workData, settings, inputMode, unitPrice, palletPrice, summary } = useMonthSettlement({
    ownerKey, clientScopeKey, year: now.getFullYear(), month: now.getMonth(),
  })
  const record = workData[today.dateKey]
  const inspectionMissing = useTodayInspectionMissing({
    ownerKey, dateKey: today.dateKey, enabled: !!resolveLogSettings(settings, 'main').dailyInspectionOn, isOff: isOffDay(record),
  })
  const { items: unpaidItems, hasSubCars } = useReceivablesData(ownerKey, session?.accountType === 'employed_driver')

  return (
    <div className="page home-page">
      <AppTopBar notifCount={notifCount} onOpenNotifs={onOpenNotifs} onOpenMenu={onOpenMenu} />

      <HomeTodayCard
        record={record}
        today={today}
        weekday={now.getDay()}
        inputMode={inputMode}
        unitPrice={unitPrice}
        palletPrice={palletPrice}
        onOpenToday={onOpenToday}
      />
      <HomeAssistantBar />
      <HomeTodoCard
        inspectionMissing={inspectionMissing}
        unpaidRows={unpaidRowsByCar(unpaidItems, hasSubCars)}
        onOpenInspection={() => onOpenToday(today.dateKey)}
        onOpenReceivables={onOpenReceivables}
      />
      <HomeMonthCard total={summary.total} expenseTotal={summary.maint + summary.fuel + summary.misc} onOpenCalendar={onOpenCalendar} />
    </div>
  )
}
