// @ts-check
/** @typedef {import('../../../data/sync/syncTypes.ts').AppSession} AppSession */
import { useState } from 'react'
import { redeemDriverInviteCode } from '../../../data/sync/driverLinkRpc.ts'
import { pickInviteCodeFromText } from '../../../domain/drivers.ts'
import { buildCloudAppSession, ownerKeyFromSession } from '../../../data/cloud/appSession.ts'
import { hydrateFromSupabase } from '../../../data/hydrate/hydrate.ts'
import ClearableInput from '../../../shared/ui/ClearableInput.jsx'
import InfoTip from '../../../shared/ui/InfoTip.jsx'
import './InviteRedeemModal.css'
import ModalShell from '../../../shared/ui/ModalShell.jsx'
import { useToast } from '../../../shared/hooks/useToast.js'
import { useSession } from '../../../data/cloud/sessionContext.ts'

const LINKED_INFO = `일지는 차주님이 배정한 차량으로 기록되고, 계약기간 안 날짜만 기록할 수 있습니다.
개인정보의 사업자 정보와 정산 계좌는 차주님이 입력한 값이 보이고, 고칠 수 없습니다.
앱 설정은 기사님 것 그대로입니다.
해제는 마이페이지 → 개인정보에서 요청하고, 차주님이 동의하거나 3일이 지나면 해제됩니다. 연동 중에는 탈퇴할 수 없습니다.`

/** @param {string} value */
function pickCodeFromPaste(value) {
  return value.length > 11 ? pickInviteCodeFromText(value) ?? value : value
}

/**
 * @param {{ onClose: () => void, onLinked: (session: AppSession) => void }} props
 */
export default function InviteRedeemModal({ onClose, onLinked }) {
  const { session } = useSession()
  const showToast = useToast()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = code.trim().length >= 4 && !busy

  async function submit() {
    if (!ready || !session?.userId) return
    setBusy(true)
    try {
      await redeemDriverInviteCode(code)
      const next = await buildCloudAppSession(session.userId, {
        name: session.name,
        phone: session.phone,
      })
      try {
        await hydrateFromSupabase(session.userId, ownerKeyFromSession(next), { employedDriver: !!next.linkedOwnerId })
      } catch (error) {
        console.error(error)
        showToast?.('연동은 완료했지만 일부 기록을 불러오지 못했습니다.')
      }
      showToast?.('차주와 연동되었습니다.')
      onLinked(next)
    } catch (error) {
      const message = error instanceof Error ? error.message : '초대 코드 연동에 실패했습니다.'
      showToast?.(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose} closeOnOverlay={false} closeOnEscape={false} contentClassName="modal-content client-modal invite-redeem-modal" label="초대코드 입력">
      <div className="modal-title">초대 코드 입력</div>
      <p className="invite-redeem-note">
        차주에게 받은 초대 코드를 입력하거나, 받은 문자를 통째로 붙여넣어 주세요.<br />
        연동이 완료되면 기사님이 입력한 운행 및 매출 내역이 차주와 공유됩니다. <InfoTip name="연동하면 바뀌는 것" info={LINKED_INFO} />
      </p>
      <div className="form-group">
        <label htmlFor="driverInviteCode">초대 코드</label>
        <ClearableInput
          id="driverInviteCode"
          className="input-box"
          placeholder="초대 코드 또는 받은 문자 전체"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(pickCodeFromPaste(e.target.value))}
          disabled={busy}
        />
      </div>
      <div className="modal-btns">
        <button type="button" className="modal-btn cancel" disabled={busy} onClick={onClose}>취소</button>
        <button type="button" className="modal-btn confirm" disabled={!ready} onClick={submit}>{busy ? '연동 중…' : '연동하기'}</button>
      </div>
    </ModalShell>
  )
}
