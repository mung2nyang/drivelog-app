import { createContext, createElement, useContext } from 'react'
import type { ReactNode } from 'react'
import type { AppSession } from '../sync/syncTypes.ts'

export type SessionValue = { session: AppSession | null, ownerKey: string }

const GUEST: SessionValue = { session: null, ownerKey: 'guest' }

const SessionContext = createContext(GUEST)

export function SessionProvider({ value, children }: { value: SessionValue, children?: ReactNode }) {
  return createElement(SessionContext.Provider, { value }, children)
}

export function useSession(): SessionValue {
  return useContext(SessionContext)
}
