import { useEffect, useId, useRef, useState } from 'react'
import './app-dropdown.css'

type Props = {
  label: string,
  value: string | number,
  options: Array<{ value: string, label: string }>,
  onChange: (next: string) => void,
  className?: string,
  placeholder?: string, // 값과 맞는 항목이 없을 때 버튼에 보일 글자(없으면 첫 항목)
  id?: string, // 단추 id(칸 오류 표시에서 커서를 옮길 때)
  invalid?: boolean, // 입력이 잘못된 칸 — 단추에 빨간 표시(FieldError.tsx)
  describedBy?: string, // 칸 아래 오류 문구 id
}

/**
 * 버튼+목록으로 된 드롭다운.
 * 네이티브 select 색만 바꾸는 방식은 쓰지 않는다.
 */
export default function AppDropdown({ label, value, options, onChange, className = '', placeholder, id, invalid = false, describedBy }: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const matchedIndex = options.findIndex((item) => String(item.value) === String(value))
  const selectedIndex = Math.max(0, matchedIndex)
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const selected = matchedIndex < 0 && placeholder !== undefined ? null : (options[selectedIndex] || options[0])
  const rootClass = ['app-dropdown', className, open ? 'open' : ''].filter(Boolean).join(' ')

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef.current && !rootRef.current.contains(target)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const list = listRef.current
    const option = list?.querySelector(`[data-index="${activeIndex}"]`)
    if (option && typeof option.scrollIntoView === 'function') option.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  function move(next: number) {
    if (options.length === 0) return
    const wrapped = (next + options.length) % options.length
    setActiveIndex(wrapped)
  }

  function choose(nextValue: string) {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        type="button"
        id={id}
        className="app-dropdown-trigger"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onClick={() => {
          setActiveIndex(selectedIndex)
          setOpen((prev) => !prev)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (!open) {
              setActiveIndex(selectedIndex)
              setOpen(true)
            } else move(activeIndex + 1)
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) {
              setActiveIndex(selectedIndex)
              setOpen(true)
            } else move(activeIndex - 1)
          } else if (event.key === 'Enter' && open) {
            event.preventDefault()
            const item = options[activeIndex]
            if (item) choose(String(item.value))
          }
        }}
      >
        <span className="app-dropdown-value">{selected ? selected.label : (placeholder || '')}</span>
        <span className="app-dropdown-chevron" aria-hidden="true" />
      </button>
      <div
        id={listId}
        className="app-dropdown-menu"
        role="listbox"
        ref={listRef}
        hidden={!open}
        aria-label={label}
      >
        {open && options.map((item, index) => (
          <button
            key={String(item.value)}
            type="button"
            className="app-dropdown-option"
            role="option"
            data-index={index}
            aria-selected={String(item.value) === String(value)}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(String(item.value))}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
