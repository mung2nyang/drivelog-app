import { createElement } from 'react'
import type { ReactNode } from 'react'
import { SessionProvider } from '../data/cloud/sessionContext.ts'
import type { AppSession } from '../data/sync/syncTypes.ts'

export function withSession(element: ReactNode, { ownerKey = 'guest', session = null }: { ownerKey?: string, session?: AppSession | null }) {
  return createElement(SessionProvider, { value: { ownerKey, session } }, element)
}
