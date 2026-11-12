import type { ReactNode } from 'react'
import InfoTip from './InfoTip.tsx'

type Props = {
  className: string,
  label: ReactNode,
  labelClassName?: string,
  value: ReactNode,
  infoName: string,
  info: string,
}

export default function SummaryInfoToggle({ className, label, labelClassName, value, infoName, info }: Props) {
  return (
    <div className={className}>
      <span className="summary-info-label">
        <span className={labelClassName}>{label}</span>
        <InfoTip name={infoName} info={info} />
      </span>
      <span className="summary-value">{value}</span>
    </div>
  )
}
