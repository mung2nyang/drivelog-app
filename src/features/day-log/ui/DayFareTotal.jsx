// @ts-check
import { dayFareTotal } from '../../../domain/calendarBadges.ts'
import { formatWon, parseCurrencyValue } from '../../../domain/money.ts'

/** @typedef {import('./dayLogTypes.js').ClientLike} ClientLike */

/**
 * @param {Object} props
 * @param {import('../../../domain/dayRecordTypes.ts').DayRecordLike} props.draft
 * @param {ClientLike|null} props.fixedRouteClient
 * @param {boolean} props.palletOn
 */
export default function DayFareTotal({ draft, fixedRouteClient, palletOn }) {
  const palletPrice = palletOn ? parseCurrencyValue(fixedRouteClient?.palletPrice) : 0
  const amount = draft.isOff ? 0 : dayFareTotal(draft, fixedRouteClient?.fixedUnitPrice ?? 0, palletPrice)
  return (
    <p className="day-fare-total">
      {amount > 0 && <>운송료 합계 <strong>{formatWon(amount)}</strong></>}
    </p>
  )
}
