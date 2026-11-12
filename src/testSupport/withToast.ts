import { createElement } from 'react'
import type { ReactNode } from 'react'
import { ToastProvider } from '../shared/hooks/useToast.ts'

export function withToast(element: ReactNode, showToast: (message: string) => void) {
  return createElement(ToastProvider, { value: showToast }, element)
}
