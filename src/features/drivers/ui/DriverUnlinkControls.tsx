import { unlinkAutoDateLabel } from '../../../data/sync/driverUnlink.ts'
import type { UnlinkAction } from '../../../data/sync/driverUnlink.ts'
import type { DriverRecord } from '../../../domain/driverTypes.ts'

export default function DriverUnlinkControls({ driver, meId, counterpartLabel, onAction }: {   driver: DriverRecord,   meId: string,   counterpartLabel: string,   onAction: (action: UnlinkAction) => void, }) {
  const requestedBy = driver.unlinkRequestedBy || ''
  if (!requestedBy) {
    return <button type="button" className="driver-card-action-btn danger" onClick={() => onAction('request')}>해제 요청</button>
  }
  const due = unlinkAutoDateLabel(driver.unlinkRequestedAt)
  const dueText = due ? ` (${due}에 자동으로 연동 해제)` : ''
  if (requestedBy === meId) {
    return (
      <>
        <span className="car-sub-text driver-unlink-status">해제 요청 중 — {counterpartLabel} 동의 대기{dueText}</span>
        <button type="button" className="driver-card-action-btn" onClick={() => onAction('cancel')}>요청 취소</button>
      </>
    )
  }
  return (
    <>
      <span className="car-sub-text driver-unlink-status">{counterpartLabel}가 해제를 요청했습니다{dueText}</span>
      <button type="button" className="driver-card-action-btn danger" onClick={() => onAction('consent')}>동의</button>
    </>
  )
}
