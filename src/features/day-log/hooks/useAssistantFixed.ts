import { useEffect, useRef, useState } from 'react'
import { useToast } from '../../../shared/hooks/useToast.ts'

export type AssistantFixed = { count: number, route: string, cancelOff: boolean }

type UseAssistantFixedProps = {
  assistantFixed: AssistantFixed|null
  assistantCallKey?: string
  fixedOn: boolean
  routePresets: Array<{ id: string, loadLoc: string, unloadLoc: string }>
  draft: { isOff: boolean, fixedCount: number }
  patchDraft: (patch: { isOff?: boolean, fixedCount?: number }) => void
  runRoute: (routeId: string, delta: number) => void
}

export default function useAssistantFixed({ assistantFixed, assistantCallKey, fixedOn, routePresets, draft, patchDraft, runRoute }: UseAssistantFixedProps) {
  const showToast = useToast()
  const [handoff, setHandoff] = useState<{ key: string|undefined, fixed: AssistantFixed|null }>({ key: assistantCallKey, fixed: assistantFixed })
  if (assistantFixed && assistantCallKey !== handoff.key) setHandoff({ key: assistantCallKey, fixed: assistantFixed })
  const doneRef = useRef<object|null>(null)
  useEffect(() => {
    if (!handoff.fixed || assistantFixed || doneRef.current === handoff) return
    doneRef.current = handoff
    const next = handoff.fixed
    if (!fixedOn) return
    if (draft.isOff && !next.cancelOff) return
    if (draft.isOff) patchDraft({ isOff: false, fixedCount: draft.fixedCount })
    const preset = next.route ? routePresets.find((route) => `${route.loadLoc} → ${route.unloadLoc}` === next.route) : undefined
    if (preset) runRoute(preset.id, next.count)
    else patchDraft({ fixedCount: (Number(draft.fixedCount) || 0) + next.count })
    showToast?.(`${preset ? next.route : '고정 노선'} ${next.count}회를 더했습니다.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff, assistantFixed])
}
