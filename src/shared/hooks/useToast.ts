// 화면 아래 알림 문구 — 앱 맨 위 공급자에서 꺼내 쓴다(손으로 넘기지 않음). 공급자 밖에선 아무 일 안 함.
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
