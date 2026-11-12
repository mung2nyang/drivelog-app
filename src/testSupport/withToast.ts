// 테스트용 — 화면을 알림 공급자로 감싸 띄운 알림 문구를 모은다.
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { ToastProvider } from '../shared/hooks/useToast.ts'

export function withToast(element: ReactNode, showToast: (message: string) => void) {
  return createElement(ToastProvider, { value: showToast }, element)
}
