// 테스트용 — 화면을 세션 공급자로 감싸 지금 보는 사람(ownerKey)과 로그인 정보(session)를 넘긴다.
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { SessionProvider } from '../data/cloud/sessionContext.ts'
import type { AppSession } from '../data/sync/syncTypes.ts'

export function withSession(element: ReactNode, { ownerKey = 'guest', session = null }: { ownerKey?: string, session?: AppSession | null }) {
  return createElement(SessionProvider, { value: { ownerKey, session } }, element)
}
