// 입력이 잘못된 칸 표시 — 칸에는 "잘못됨"(aria-invalid, 빨간 테두리), 칸 바로 아래에 빨간 문구.

export type FieldProblem = { field: string, message: string }

/** 칸에 붙일 표시 — 문제 칸이면 "잘못됨"과 아래 문구 연결, 아니면 없음. */
export function invalidProps(problem: FieldProblem | null, field: string, inputId: string): { 'aria-invalid'?: boolean, 'aria-describedby'?: string } {
  if (problem?.field !== field) return {}
  return { 'aria-invalid': true, 'aria-describedby': `${inputId}-error` }
}

export default function FieldError({ problem, field, inputId }: { problem: FieldProblem | null, field: string, inputId: string }) {
  if (problem?.field !== field) return null
  return (
    <p className="field-error" id={`${inputId}-error`} role="alert">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="7.5" x2="12" y2="13" />
        <line x1="12" y1="16.5" x2="12.01" y2="16.5" />
      </svg>
      {problem.message}
    </p>
  )
}

// 문제 칸으로 화면을 옮기고 커서를 넣는다 — 날짜 칸은 숨은 입력 대신 단추로.
export function focusField(inputId: string) {
  const input = document.getElementById(inputId)
  const target = input?.closest('.app-temporal')?.querySelector('button') ?? input
  target?.scrollIntoView?.({ block: 'center' })
  target?.focus({ preventScroll: true })
}
