// @ts-check
import { useCallback, useRef, useState } from 'react'
import ConfirmModal from '../../../shared/ui/ConfirmModal.tsx'

/** @typedef {{ confirmLabel?: string, danger?: boolean, message?: string }} ConfirmOptions */
/** @typedef {{ message: string, options: ConfirmOptions, resolve: (value: boolean) => void }} PendingConfirm */

export function useConfirm() {
  const [pending, setPending] = useState(/** @type {PendingConfirm|null} */ (null))
  const pendingRef = useRef(/** @type {PendingConfirm|null} */ (null))

  const confirm = useCallback((/** @type {string} */ message, /** @type {ConfirmOptions} */ options = {}) => new Promise((resolve) => {
    const next = { message, options, resolve }
    pendingRef.current = next
    setPending(next)
  }), [])

  const close = useCallback((/** @type {boolean} */ value) => {
    const current = pendingRef.current
    if (!current) return
    pendingRef.current = null
    current.resolve(value)
    setPending(null)
  }, [])

  const confirmDialog = pending ? (
    <ConfirmModal
      title={pending.message}
      message={pending.options.message}
      confirmLabel={pending.options.confirmLabel}
      danger={pending.options.danger}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  ) : null

  return { confirm, confirmDialog }
}
