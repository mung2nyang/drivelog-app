import { useState } from 'react'
import ModalShell from '../../../shared/ui/ModalShell.tsx'
import { useToast } from '../../../shared/hooks/useToast.ts'
import { saveGuestBackupFile } from '../api/guestBackupFile.ts'

const TEXT_STYLE = { wordBreak: 'keep-all' as const, textAlign: 'left' as const }
const SUB_TEXT_STYLE = { ...TEXT_STYLE, marginTop: 10, color: 'var(--sub-text-color)', fontSize: 'var(--fs-2)' }
const BUTTONS_STYLE = { flexDirection: 'column' as const }

export default function GuestLoginBackupModal({ onClose, onLogin }: { onClose: () => void, onLogin: () => void }) {
  const showToast = useToast()
  const [busy, setBusy] = useState(false)

  async function saveAndLogin() {
    if (busy) return
    setBusy(true)
    try {
      const hint = await saveGuestBackupFile()
      showToast?.(`백업 파일을 저장했습니다.${hint}`)
      onLogin()
    } catch (error) {
      console.error('로그인 전 백업 저장 실패:', error)
      showToast?.('백업 파일 생성에 실패했습니다.')
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose} closeOnOverlay={!busy} closeOnEscape={!busy} label="비회원 기록 옮기기">
      <div className="modal-title">비회원 기록 옮기기</div>
      <p className="confirm-modal-text" style={TEXT_STYLE}>
        로그인하면 이 휴대폰에 입력한 비회원 기록은 계정에 자동으로 옮겨지지 않습니다. 먼저 백업 파일을 저장하고, 로그인한 뒤 마이페이지 → 데이터 다운로드에서 [불러오기]로 그 파일을 고르면 계정에 추가됩니다.
      </p>
      <p className="confirm-modal-text" style={SUB_TEXT_STYLE}>
        비회원 기록은 지워지지 않고 이 휴대폰에 그대로 남습니다.
      </p>
      <div className="modal-btns" style={BUTTONS_STYLE}>
        <button type="button" className="modal-btn confirm" disabled={busy} onClick={() => { void saveAndLogin() }}>백업 저장 후 로그인</button>
        <button type="button" className="modal-btn cancel" disabled={busy} onClick={onLogin}>그냥 로그인</button>
        <button type="button" className="modal-btn cancel" disabled={busy} onClick={onClose}>취소</button>
      </div>
    </ModalShell>
  )
}
