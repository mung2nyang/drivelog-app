// 정산 카드 한 줄 + 이름 옆 (i) 버튼, 누르면 (i) 바로 아래에 설명 카드가 뜬다.
import type { ReactNode } from 'react'
import InfoTip from './InfoTip.tsx'

type Props = {
  className: string, // 줄 클래스(예: "summary-row total")
  label: ReactNode,
  labelClassName?: string,
  value: ReactNode,
  infoName: string, // 화면 읽기용 이름(예: "합계")
  info: string, // 펼칠 설명
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
