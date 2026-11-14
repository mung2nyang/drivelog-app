import { FixedAmountLine } from './FixedCountSection.tsx'
import type { ClientLike } from './dayLogTypes.ts'

type PalletSectionProps = {
  visible: boolean
  palletCount: number
  isOff: boolean
  fixedRouteClient: ClientLike|null
  onChange: (count: number|string) => void
}

export default function PalletSection({ visible, palletCount, isOff, fixedRouteClient, onChange }: PalletSectionProps) {
  if (!visible) return null
  const value = !isOff && palletCount > 0 ? String(palletCount) : ''
  return (
    <div className="form-group fixed-route-group pallet-route-group">
      <div className="fixed-route-input-row">
        <label htmlFor="modalPalletCount">파렛트 회수</label>
        <div className="input-with-suffix">
          <input
            id="modalPalletCount"
            type="number"
            className="input-box"
            inputMode="numeric"
            min="0"
            placeholder="0"
            value={value}
            disabled={isOff}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="suffix">장</span>
        </div>
      </div>
      <FixedAmountLine label="파렛트 금액" count={palletCount} unit="장" price={fixedRouteClient?.palletPrice} isOff={isOff} />
    </div>
  )
}
