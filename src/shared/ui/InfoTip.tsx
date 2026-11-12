import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './info-tip.css'

function rightLimit(card: HTMLElement) {
  let limit = document.documentElement.clientWidth
  for (let el = card.parentElement; el && el !== document.body; el = el.parentElement) {
    const style = window.getComputedStyle(el)
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      limit = Math.min(limit, el.getBoundingClientRect().left + el.clientWidth)
      break
    }
  }
  return limit
}

const joinParen = (text: string) => text.replace(/(?<=[가-힣])\(/g, '\u2060(').replace(/\)(?=[가-힣])/g, ')\u2060')

type Props = {
  name: string,
  info: string,
}

export default function InfoTip({ name, info }: Props) {
  const [open, setOpen] = useState(false)
  const infoId = useId()
  const cardRef = useRef<HTMLSpanElement | null>(null)
  useLayoutEffect(() => {
    const card = cardRef.current
    const anchor = card?.parentElement
    if (!open || !card || !anchor) return
    const right = anchor.getBoundingClientRect().left - 14 + card.offsetWidth
    const overflow = right - (rightLimit(card) - 12)
    card.style.setProperty('--shift', `${overflow > 0 ? -overflow : 0}px`)
  }, [open])
  return (
    <span className="summary-info-anchor">
      <button
        type="button"
        className="summary-info-btn"
        aria-label={`${name} 설명 ${open ? '접기' : '보기'}`}
        aria-expanded={open}
        aria-controls={infoId}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="11"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      </button>
      {open && (
        <span
          id={infoId}
          ref={cardRef}
          role="note"
          className="summary-info-text"
          style={{ '--shift': '-9999px' } as CSSProperties}
        >
          {joinParen(info)}
        </span>
      )}
    </span>
  )
}
