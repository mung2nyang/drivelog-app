import { createContext, createElement, useContext } from 'react'
import type { ReactNode } from 'react'

export type ShowToast = (message: string) => void

const ignoreToast: ShowToast = () => {}

const ToastContext = createContext(ignoreToast)

export function ToastProvider({ value, children }: { value: ShowToast, children?: ReactNode }) {
  return createElement(ToastContext.Provider, { value }, children)
}

export function useToast(): ShowToast {
  return useContext(ToastContext)
}
