import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'

const openShells: Array<object> = []

type Props = {
  onClose: () => void,
  closeOnOverlay?: boolean,
  closeOnEscape?: boolean,
  role?: 'dialog' | 'alertdialog',
  label?: string,
  labelledBy?: string,
  contentClassName?: string,
  overlayClassName?: string,
  initialFocusRef?: RefObject<HTMLElement | null>,
  children?: ReactNode,
}

export default function ModalShell({
  onClose, closeOnOverlay = true, closeOnEscape = true, role = 'dialog', label, labelledBy,
  contentClassName = 'modal-content', overlayClassName = 'modal-overlay', initialFocusRef, children,
}: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const latest = useRef({ onClose, closeOnEscape })
  useEffect(() => { latest.current = { onClose, closeOnEscape } })

  useEffect(() => {
    const token = {}
    openShells.push(token)
    const previous = document.activeElement as HTMLElement | null
    ;(initialFocusRef?.current || boxRef.current)?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || openShells[openShells.length - 1] !== token) return
      if (latest.current.closeOnEscape) latest.current.onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      openShells.splice(openShells.indexOf(token), 1)
      previous?.focus?.()
    }
  }, [initialFocusRef])

  return (
    <div className={overlayClassName} onClick={closeOnOverlay ? onClose : undefined}>
      <div
        ref={boxRef}
        className={contentClassName}
        role={role}
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
