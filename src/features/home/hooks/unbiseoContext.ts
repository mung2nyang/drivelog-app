// 운비서 대화는 앱 전체에 하나 — 홈 카드와 떠 있는 줄이 같이 쓴다. 휴대폰에 저장하지 않는다.
import { createContext, createElement, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { UnbiseoRecord } from '../api/unbiseoParse.ts'
import useUnbiseoAssistant from './useUnbiseoAssistant.ts'
import type { UnbiseoAnswer, UnbiseoAssistant } from './useUnbiseoAssistant.ts'

export type OpenAssistantCall = (record: UnbiseoRecord, options: { cancelOff: boolean }) => void

type UnbiseoShared = {
  assistant: UnbiseoAssistant
  /** 바로 열기·[기록하기]·[휴무 취소하고 기록] — 떠 있는 줄을 줄이고 그 날짜 일지·거래처 화면으로 */
  openCall: OpenAssistantCall
  /** 떠 있는 줄이 펼쳐져 있나(화면을 옮겨도 그대로, 앱을 다시 켜면 줄임) */
  dockOpen: boolean
  setDockOpen: (open: boolean) => void
}

const UnbiseoContext = createContext<UnbiseoShared | null>(null)

/** 버튼 없이 바로 열 답 — 운행·지출·새 거래처, 기간 밖·휴무·운행 세부 입력 꺼짐이면 아님 */
export function directRecord({ answer, periodNotice, dayOff, callDetailOn }: UnbiseoAssistant): UnbiseoRecord | null {
  if (answer?.client) return answer.client
  if (periodNotice || dayOff) return null
  if (answer?.call) return callDetailOn ? answer.call : null
  return answer?.expense ?? null
}

export function UnbiseoProvider({ onOpenCall, children }: { onOpenCall: OpenAssistantCall, children?: ReactNode }) {
  const assistant = useUnbiseoAssistant()
  const [dockOpen, setDockOpen] = useState(false)
  const openCall: OpenAssistantCall = (call, options) => {
    setDockOpen(false)
    onOpenCall(call, options)
  }
  // 새 답이 오면 한 번만 바로 연다(고정 노선·휴무·점검표는 카드 버튼으로).
  const seen = useRef<UnbiseoAnswer | null>(null)
  useEffect(() => {
    if (!assistant.answer || seen.current === assistant.answer) return
    seen.current = assistant.answer
    const record = directRecord(assistant)
    // oxlint-disable-next-line react/set-state-in-effect -- 답은 서버에서 늦게 오므로 받은 뒤 한 번 연다.
    if (record) openCall(record, { cancelOff: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 새 답이 올 때만
  }, [assistant.answer])
  return createElement(UnbiseoContext.Provider, { value: { assistant, openCall, dockOpen, setDockOpen } }, children)
}

export function useUnbiseo(): UnbiseoShared {
  const shared = useContext(UnbiseoContext)
  if (!shared) throw new Error('UnbiseoProvider 밖에서 운비서를 불렀습니다.')
  return shared
}
