import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DateColumns, TimeColumns } from './TemporalColumns.tsx'
import { pad, parseCursor } from './temporalValue.ts'
import './temporal-input.css'

const EDGE = 8
const GAP = 7

type Props = {
  type: 'date' | 'time',
  id: string,
  value: string,
  onChange: (event: { target: { value: string } }) => void,
  className?: string,
  min?: string,
  max?: string,
  disabled?: boolean,
  centered?: boolean,
  invalid?: boolean,
  describedBy?: string,
  clearable?: boolean,
}

export default function TemporalInput({ type, id, value, onChange, className = '', min, max, disabled = false, centered = false, invalid = false, describedBy, clearable = false }: Props) {
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => parseCursor(type, value))
  const [pos, setPos] = useState<{ left: number, top: number, width: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  function commit(nextValue: string) {
    onChange({ target: { value: nextValue } })
  }

  function reposition() {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const viewportWidth = window.visualViewport?.width || document.documentElement.clientWidth
    const availableRight = viewportWidth - EDGE
    const left = rect.right > availableRight ? Math.max(EDGE, availableRight - rect.width) : rect.left
    setPos({ left, top: rect.bottom + GAP, width: rect.width })
  }

  useEffect(() => {
    if (!open) return undefined
    setCursor(parseCursor(type, value))
    reposition()
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof window.Node)) return
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type])

  useEffect(() => {
    if (!open) return
    const options = menuRef.current?.querySelectorAll('[aria-selected="true"]')
    options?.forEach((option) => {
      if (typeof option.scrollIntoView === 'function') option.scrollIntoView({ block: 'center' })
    })
  }, [open, cursor])

  function selectDay(day: number) {
    commit(`${cursor.year}-${pad(cursor.month)}-${pad(day)}`)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function commitHour(hour: number) {
    const minute = value ? cursor.minute : 0
    commit(`${pad(hour)}:${pad(minute)}`)
    setCursor({ ...cursor, hour, minute })
  }

  function selectMinute(minute: number) {
    commit(`${pad(cursor.hour)}:${pad(minute)}`)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function clear() {
    commit('')
    setOpen(false)
    triggerRef.current?.focus()
  }

  const label = !value ? (type === 'date' ? '날짜 선택' : '시간 선택') : type === 'date' ? value.replaceAll('-', '.') : value

  return (
    <span className={`app-temporal app-temporal-${type} ${className}`.trim()}>
      <input
        type={type}
        id={id}
        value={value || ''}
        min={min}
        max={max}
        disabled={disabled}
        readOnly
        tabIndex={-1}
        onClick={(event) => {
          event.preventDefault()
          if (!disabled) setOpen(true)
        }}
      />
      <button
        type="button"
        ref={triggerRef}
        className={`app-temporal-trigger${centered ? ' is-centered' : ''}${value ? ' has-value' : ''}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="app-temporal-value">{label}</span>
        <span className="app-temporal-icon" aria-hidden="true" />
      </button>
      {open && pos && createPortal(
        <div
          id={menuId}
          ref={menuRef}
          className="app-temporal-menu"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
        >
          {type === 'date'
            ? <DateColumns cursor={cursor} min={min} max={max} onCursor={setCursor} onSelectDay={selectDay} />
            : <TimeColumns cursor={cursor} onCommitHour={commitHour} onSelectMinute={selectMinute} />}
          {clearable && value && <button type="button" className="app-temporal-clear" onClick={clear}>지우기</button>}
        </div>,
        document.body
      )}
    </span>
  )
}
