// @ts-check
import { useEffect, useRef, useState } from 'react'
import { useToast } from '../../../shared/hooks/useToast.ts'

/** @typedef {{ count: number, route: string, cancelOff: boolean }} AssistantFixed */

/**
 * @param {Object} args
 * @param {AssistantFixed|null} args.assistantFixed
 * @param {string} [args.assistantCallKey]
 * @param {boolean} args.fixedOn
 * @param {Array<{ id: string, loadLoc: string, unloadLoc: string }>} args.routePresets
 * @param {{ isOff: boolean, fixedCount: number }} args.draft
 * @param {(patch: { isOff?: boolean, fixedCount?: number }) => void} args.patchDraft
 * @param {(routeId: string, delta: number) => void} args.runRoute
 */
export default function useAssistantFixed({ assistantFixed, assistantCallKey, fixedOn, routePresets, draft, patchDraft, runRoute }) {
  const showToast = useToast()
  const [handoff, setHandoff] = useState(/** @type {{ key: string|undefined, fixed: AssistantFixed|null }} */ ({ key: assistantCallKey, fixed: assistantFixed }))
  if (assistantFixed && assistantCallKey !== handoff.key) setHandoff({ key: assistantCallKey, fixed: assistantFixed })
  const doneRef = useRef(/** @type {object|null} */ (null))
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
