import { useCallback, useRef, useState } from 'react'
import ConfirmModal from '../../../shared/ui/ConfirmModal.tsx'

export type ConfirmOptions = { confirmLabel?: string, danger?: boolean, message?: string }
export type PendingConfirm = { message: string, options: ConfirmOptions, resolve: (value: boolean) => void }

export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm|null>(null)
  const pendingRef = useRef<PendingConfirm|null>(null)

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => new Promise<boolean>((resolve) => {
    const next = { message, options, resolve }
    pendingRef.current = next
    setPending(next)
  }), [])

  const close = useCallback((value: boolean) => {
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
