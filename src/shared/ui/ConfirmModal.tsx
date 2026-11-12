import { useId, useRef } from 'react'
import ModalShell from './ModalShell.tsx'

type Props = {
  title?: string, message?: string, onCancel: () => void, onConfirm: () => void,
  confirmLabel?: string,
  cancelLabel?: string,
  danger?: boolean,
}

export default function ConfirmModal({ title = '경고', message, confirmLabel = '확인', cancelLabel = '취소', danger = false, onCancel, onConfirm }: Props) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement | null>(null)

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
