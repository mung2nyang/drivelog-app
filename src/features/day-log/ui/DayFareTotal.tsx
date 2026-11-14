import { dayFareTotal } from '../../../domain/calendarBadges.ts'
import { formatWon, parseCurrencyValue } from '../../../domain/money.ts'
import type { DayRecordLike } from '../../../domain/dayRecordTypes.ts'
import type { ClientLike } from './dayLogTypes.ts'

type DayFareTotalProps = {
  draft: DayRecordLike
  fixedRouteClient: ClientLike|null
  palletOn: boolean
}

export default function DayFareTotal({ draft, fixedRouteClient, palletOn }: DayFareTotalProps) {
  const palletPrice = palletOn ? parseCurrencyValue(fixedRouteClient?.palletPrice) : 0
  const amount = draft.isOff ? 0 : dayFareTotal(draft, fixedRouteClient?.fixedUnitPrice ?? 0, palletPrice)
  return (
    <p className="day-fare-total">
      {amount > 0 && <>운송료 합계 <strong>{formatWon(amount)}</strong></>}
    </p>
  )
}
