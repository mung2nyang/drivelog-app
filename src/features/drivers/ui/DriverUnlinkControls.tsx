import { unlinkAutoDateLabel } from '../../../data/sync/driverUnlink.ts'
import type { UnlinkAction } from '../../../data/sync/driverUnlink.ts'
import type { DriverRecord } from '../../../domain/driverTypes.ts'
import { confirmDialog } from '../../../shared/ui/confirmDialog.tsx'
import type { ConfirmRequest } from '../../../shared/ui/confirmDialog.tsx'

const COPIED = '연동 기간의 운행 기록과 거래처 정보(상호, 담당자, 사업자번호, 전화번호)가'

function confirmRequest(action: UnlinkAction, counterpartLabel: string): ConfirmRequest | null {
  const target = counterpartLabel === '기사' ? '기사 계정' : '내 계정'
  if (action === 'request') {
    return {
      title: `${counterpartLabel} 연동 해제`,
      message: `${counterpartLabel}가 동의하거나 3일이 지나면 해제돼요. 해제 시 ${COPIED} ${target}으로 복사돼요.`,
      confirmLabel: '해제 요청',
      cancelLabel: '취소',
      danger: true,
    }
  }
  if (action === 'consent') {
    return {
      title: '연동 해제',
      message: `동의하면 바로 해제되며 되돌릴 수 없어요. ${COPIED} ${target}으로 복사돼요.`,
      confirmLabel: '해제 동의',
      cancelLabel: '취소',
      danger: true,
    }
  }
  return null
}

export default function DriverUnlinkControls({ driver, meId, counterpartLabel, onAction }: {   driver: DriverRecord,   meId: string,   counterpartLabel: string,   onAction: (action: UnlinkAction) => void, }) {
  async function run(action: UnlinkAction) {
    const request = confirmRequest(action, counterpartLabel)
    if (request && !(await confirmDialog(request))) return
    onAction(action)
  }
  const requestedBy = driver.unlinkRequestedBy || ''
  if (!requestedBy) {
    return <button type="button" className="driver-card-action-btn danger" onClick={() => { void run('request') }}>해제 요청</button>
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
      <button type="button" className="driver-card-action-btn danger" onClick={() => { void run('consent') }}>동의</button>
    </>
  )
}
