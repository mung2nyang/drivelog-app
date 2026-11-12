// @ts-check
import { useId, useState } from 'react'
import { useOwnerDrivers, useOwnerProfile } from '../../../data/store/ownerDataHooks.ts'
import ModalShell from '../../../shared/ui/ModalShell.tsx'
import { useSession } from '../../../data/cloud/sessionContext.ts'

/** @param {{ employed: boolean, onOpenProfile: () => void, children: import('react').ReactNode }} props */
export default function LinkStatusChip({ employed, onOpenProfile, children }) {
  const { ownerKey } = useSession()
  const drivers = useOwnerDrivers(ownerKey)
  const profile = useOwnerProfile(ownerKey)
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const link = employed ? drivers.find((driver) => driver.status === 'linked') : undefined

  return (
    <div className={`mypage-profile-wrap${link ? ' has-link-chip' : ''}`}>
      {children}
      {link && (
        <button type="button" className="mypage-link-chip" aria-haspopup="dialog" aria-label="연동중, 연동 정보 보기" onClick={() => setOpen(true)}>
          연동중
        </button>
      )}
      {link && open && (
        <ModalShell onClose={() => setOpen(false)} labelledBy={titleId}>
          <div className="modal-title" id={titleId}>연동 중</div>
          <dl className="link-status-rows">
            <dt>운송사</dt><dd>{profile.bizName || '연동된 운송사'}</dd>
            <dt>배정 차량</dt><dd>{link.vehicleNumber || '-'}</dd>
            <dt>계약기간</dt><dd>{link.startDate || '-'} ~ {link.endDate || '종료일 없음'}</dd>
          </dl>
          <p className="confirm-modal-text">{'개인정보 > 소속 연결에서 연동을 해제할 수 있습니다.'}</p>
          <div className="modal-btns">
            <button type="button" className="modal-btn cancel" onClick={() => setOpen(false)}>닫기</button>
            <button type="button" className="modal-btn confirm" onClick={() => { setOpen(false); onOpenProfile() }}>개인정보로 가기</button>
          </div>
        </ModalShell>
      )}
    </div>
  )
}
