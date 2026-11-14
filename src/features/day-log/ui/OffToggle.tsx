import { confirmDialog } from '../../../shared/ui/confirmDialog.tsx'

export async function confirmOffWithCalls(off: boolean, callCount: number): Promise<boolean> {
  if (!off || callCount <= 0) return true
  return confirmDialog({
    title: '휴무로 바꾸시겠습니까?',
    message: `이날 콜 ${callCount}건이 있습니다. 휴무로 바꾸면 이 콜은 합계와 미수에서 빠집니다.`,
    confirmLabel: '휴무로 바꾸기',
    cancelLabel: '취소',
  })
}

type OffToggleProps = {
  isOff: boolean
  callCount?: number
  onChange: (off: boolean) => void
}

export default function OffToggle({ isOff, callCount = 0, onChange }: OffToggleProps) {
  async function toggle() {
    const next = !isOff
    if (await confirmOffWithCalls(next, callCount)) onChange(next)
  }
  return (
    <div className="btn-group-toggle">
      <button
        type="button"
        className={`toggle-btn${isOff ? ' active-off' : ''}`}
        onClick={() => { void toggle() }}
      >
        휴무
      </button>
    </div>
  )
}
