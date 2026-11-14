import { useEffect, useRef, useState } from 'react'
import type { ReactNode, TransitionEvent } from 'react'

type InlineSheetProps = {
  open: boolean
  forceInstant?: boolean
  className?: string
  scrollKey?: string
  children: ReactNode
}

export default function InlineSheet({ open, forceInstant = false, className = '', scrollKey, children }: InlineSheetProps) {
  const [mounted, setMounted] = useState(open)
  const [settled, setSettled] = useState(false)
  const lastChildrenRef = useRef(children)
  const panelRef = useRef<HTMLDivElement|null>(null)
  const scrolledKeyRef = useRef<string|undefined>(undefined)
  if (open) lastChildrenRef.current = children

  function scrollToPanel() {
    const panel = panelRef.current
    scrolledKeyRef.current = scrollKey
    if (scrollKey === undefined || !panel || typeof panel.scrollIntoView !== 'function') return
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    panel.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }

  useEffect(() => {
    if (open && settled && scrollKey !== scrolledKeyRef.current) scrollToPanel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey, open, settled])

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    setSettled(false)
    if (forceInstant) setMounted(false)
  }, [open, forceInstant])

  function handleTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.propertyName !== 'grid-template-rows') return
    if (open) {
      setSettled(true)
      scrollToPanel()
    } else setMounted(false)
  }

  return (
    <div
      className={`inline-sheet ${className}${open ? ' is-visible' : ''}${settled ? ' is-settled' : ''}`.trim()}
      aria-hidden={!open}
      onTransitionEnd={handleTransitionEnd}
    >
      {mounted && <div ref={panelRef} className="inline-sheet-panel">{open ? children : lastChildrenRef.current}</div>}
    </div>
  )
}
