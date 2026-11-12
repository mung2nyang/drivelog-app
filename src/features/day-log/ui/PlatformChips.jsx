// @ts-check
import { useEffect, useRef, useState } from 'react'
import ConfirmModal from '../../../shared/ui/ConfirmModal.tsx'

const LONG_PRESS_MS = 600
const MOVE_TOLERANCE_PX = 10

/**
 * @param {Object} props
 * @param {Array<string>} props.presets
 * @param {string} props.selected
 * @param {(name: string) => void} props.onSelect
 * @param {(name: string) => void} [props.onRemove]
 */
export default function PlatformChips({ presets, selected, onSelect, onRemove }) {
  const [pendingName, setPendingName] = useState(/** @type {string|null} */ (null))
  const press = useRef(/** @type {{ timer: ReturnType<typeof setTimeout>, x: number, y: number, fired: boolean }|null} */ (null))

  function cancelPress() {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }
  useEffect(() => cancelPress, [])

  /** @param {string} name @param {{ clientX: number, clientY: number }} event */
  function startPress(name, event) {
    cancelPress()
    if (!onRemove) return
    const state = { timer: setTimeout(() => {
      state.fired = true
      setPendingName(name)
    }, LONG_PRESS_MS), x: event.clientX || 0, y: event.clientY || 0, fired: false }
    press.current = state
  }

  /** @param {{ clientX: number, clientY: number }} event */
  function movePress(event) {
    const start = press.current
    if (start && !start.fired && Math.hypot((event.clientX || 0) - start.x, (event.clientY || 0) - start.y) > MOVE_TOLERANCE_PX) cancelPress()
  }

  /** @param {string} name */
  function handleClick(name) {
    const fired = press.current?.fired
    cancelPress()
    if (fired) return
    onSelect(selected === name ? '' : name)
  }

  function confirmRemove() {
    if (pendingName !== null) onRemove?.(pendingName)
    setPendingName(null)
  }

  return (
    <>
      <div className="call-platform-quick-list">
        {presets.map((name) => (
          <button
            key={name}
            type="button"
            className={`dark-pill-btn${selected === name ? ' active' : ''}`}
            onClick={() => handleClick(name)}
            onPointerDown={(e) => startPress(name, e)}
            onPointerMove={movePress}
            onPointerLeave={() => { if (!press.current?.fired) cancelPress() }}
            onPointerCancel={() => { if (!press.current?.fired) cancelPress() }}
            onContextMenu={(e) => e.preventDefault()}
            style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
          >
            {name}
          </button>
        ))}
      </div>
      {pendingName !== null && (
        <ConfirmModal
          title={`'${pendingName}' 칩을 삭제하시겠습니까?`}
          confirmLabel="삭제"
          danger
          onCancel={() => setPendingName(null)}
          onConfirm={confirmRemove}
        />
      )}
    </>
  )
}
