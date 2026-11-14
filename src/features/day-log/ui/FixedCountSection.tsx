import { formatWon, parseCurrencyValue } from '../../../domain/money.ts'
import type { ClientLike } from './dayLogTypes.ts'

type FixedAmountLineProps = {
  label: string
  count: number
  unit: string
  price: string|number|undefined
  isOff: boolean
}

export function FixedAmountLine({ label, count, unit, price, isOff }: FixedAmountLineProps) {
  const unitPrice = Math.max(0, parseCurrencyValue(price))
  if (isOff || count <= 0 || unitPrice <= 0) return null
  return (
    <div className="fixed-route-amount">
      <span>{label}</span>
      <strong>{formatWon(count * unitPrice)}</strong>
      <span className="fixed-route-amount-formula">({count}{unit} × {formatWon(unitPrice)})</span>
    </div>
  )
}

type FixedCountSectionProps = {
  count: number
  isOff: boolean
  quickCounts: Array<number>
  fixedRouteClient: ClientLike|null
  onChange: (count: number|string) => void
}

export default function FixedCountSection({ count, isOff, quickCounts, fixedRouteClient, onChange }: FixedCountSectionProps) {
  const value = !isOff && count > 0 ? String(count) : ''
  return (
    <>
      <div className="fixed-route-input-row">
        <label htmlFor="modalFixedCountInput">운행 횟수 입력</label>
        <div className="input-with-suffix">
          <input
            id="modalFixedCountInput"
            type="number"
            className="input-box"
            inputMode="numeric"
            min="0"
            placeholder="0"
            value={value}
            disabled={isOff}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="suffix">회</span>
        </div>
      </div>
      <FixedAmountLine label="고정 노선 금액" count={count} unit="회" price={fixedRouteClient?.fixedUnitPrice} isOff={isOff} />
      {quickCounts.length > 0 && (
        <div className="fixed-count-quick-buttons" aria-label="운행 횟수 선택">
          {quickCounts.map((n) => (
            <button
              key={n}
              type="button"
              className={`quick-count-btn${count === n && !isOff ? ' active' : ''}`}
              disabled={isOff}
              onClick={() => onChange(count === n && !isOff ? 0 : n)}
            >
              {n}회
            </button>
          ))}
        </div>
      )}
    </>
  )
}
