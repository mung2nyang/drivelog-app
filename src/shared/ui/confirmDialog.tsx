import { useEffect, useState } from 'react'
import ConfirmModal from './ConfirmModal.tsx'

export type ConfirmRequest = { title: string, message?: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean }
export type PendingConfirm = { request: ConfirmRequest, resolve: (ok: boolean) => void }

let showConfirm: ((pending: PendingConfirm) => void) | null = null
let cancelOpen: (() => void) | null = null

export function confirmDialogOpen() {
  return cancelOpen !== null
}

export function cancelConfirmDialog() {
  cancelOpen?.()
}

export function confirmDialog(request: ConfirmRequest): Promise<boolean> {
  if (!showConfirm) return Promise.resolve(window.confirm([request.title, request.message].filter(Boolean).join('\n')))
  const show = showConfirm
  return new Promise((resolve) => { show({ request, resolve }) })
}

export function ConfirmDialogHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  useEffect(() => {
    showConfirm = (next) => {
      setPending((current) => { current?.resolve(false); return next })
    }
    return () => { showConfirm = null; cancelOpen = null }
  }, [])

  useEffect(() => {
    cancelOpen = pending ? () => { pending.resolve(false); setPending(null) } : null
  }, [pending])

  if (!pending) return null
  const close = (ok: boolean) => { pending.resolve(ok); setPending(null) }
  const { title, message, confirmLabel, cancelLabel, danger } = pending.request
  return (
    <ConfirmModal
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      danger={danger}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  )
}
