import { useId, useRef } from 'react'
import ModalShell from './ModalShell.tsx'

type Props = {
  title?: string, message?: string, onCancel: () => void, onConfirm: () => void,
  confirmLabel?: string, // 버튼에 실제 동작을 쓴다(삭제·저장 등).
  cancelLabel?: string, // 취소 버튼 이름(기본 "취소").
  danger?: boolean, // 되돌릴 수 없는 동작이면 빨간 버튼.
}

export default function ConfirmModal({ title = '경고', message, confirmLabel = '확인', cancelLabel = '취소', danger = false, onCancel, onConfirm }: Props) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  // 열리면 "취소"에 키보드 위치, Esc·바깥 누름은 취소.
  return (
    <ModalShell onClose={onCancel} role="alertdialog" labelledBy={titleId} initialFocusRef={cancelRef}>
      <div className="modal-title" id={titleId}>{title}</div>
      {message && <p className="confirm-modal-text">{message}</p>}
      <div className="modal-btns">
        <button type="button" className="modal-btn cancel" ref={cancelRef} onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className={`modal-btn confirm${danger ? ' danger' : ''}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </ModalShell>
  )
}
