import { useRef, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import './clearable-input.css'

export default function ClearableInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { onFocus, onBlur, ...rest } = props
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [focused, setFocused] = useState(false)
  const showClear = focused && String(props.value ?? '') !== ''

  function clear() {
    const input = inputRef.current
    if (!input) return
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setValue?.call(input, '')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  }

  return (
    <span className={`clearable-input${showClear ? ' has-clear' : ''}`}>
      <input
        {...rest}
        style={showClear ? { ...rest.style, paddingRight: 44 } : rest.style}
        ref={inputRef}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); onBlur?.(e) }}
      />
      {showClear && (
        <button
          type="button"
          className="clearable-input-btn"
          aria-label="입력 지우기"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={clear}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12"></circle><path d="M16 8 8 16M8 8l8 8"></path></svg>
        </button>
      )}
    </span>
  )
}
