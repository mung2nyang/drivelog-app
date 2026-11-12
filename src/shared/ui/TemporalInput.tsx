// 네이티브 date/time input 대신 트리거 버튼 + document.body 포털 컬럼 메뉴. 부모 창의 overflow:hidden을 벗어나야 해서
// CalendarDateSelect(absolute)와 달리 포털 + position:fixed를 쓴다(컬럼 그리기는 TemporalColumns.tsx).
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
  centered?: boolean, // 트리거 값을 가운데 정렬(콜 상세·지출 창이 씀).
  invalid?: boolean, // 입력이 잘못된 칸 — 단추에 빨간 표시(FieldError.tsx)
  describedBy?: string, // 칸 아래 오류 문구 id
  clearable?: boolean, // 값이 있을 때 고르기 창에 [지우기](비워도 되는 칸만)
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
