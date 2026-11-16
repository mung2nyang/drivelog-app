import { useCallback, useEffect, useRef, useState } from 'react'
import { saveProfile } from '../../../data/sync/profileSave.ts'
import { SERVER_SAVE_FAIL } from '../../../shared/utils/failureMessages.ts'
import { useToast } from '../../../shared/hooks/useToast.ts'
import type { LocalProfile } from '../../../data/hydrate/hydrateMergeTypes.ts'

export type ProfileDraft = Partial<Record<keyof LocalProfile, string>>

export const SAVE_DELAY_MS = 700
const SAVE_FAIL_TOAST = SERVER_SAVE_FAIL

export function usePersonalInfoDraft({ ownerKey, profile }: { ownerKey: string, profile: LocalProfile }) {
  const showToast = useToast()
  const [draft, setDraft] = useState<ProfileDraft>({})
  const dirtyRef = useRef<ProfileDraft>({})
  const timerRef = useRef<ReturnType<typeof setTimeout>|null>(null)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const latest = useRef({ ownerKey, profile, showToast })
  useEffect(() => { latest.current = { ownerKey, profile, showToast } })

  const flush = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (savingRef.current || !Object.keys(dirtyRef.current).length) return
    savingRef.current = true
    const snapshot = dirtyRef.current
    const { ownerKey: owner, profile: base, showToast: toast } = latest.current
    try {
      await saveProfile(owner, { ...base, ...snapshot })
      const rest: ProfileDraft = {}
      for (const [key, value] of Object.entries(dirtyRef.current)) {
        if (snapshot[key as keyof LocalProfile] !== value) Object.assign(rest, { [key]: value })
      }
      dirtyRef.current = rest
    } catch (error) {
      console.error('개인정보 저장 실패:', error)
      toast?.(SAVE_FAIL_TOAST)
      dirtyRef.current = {}
    } finally {
      savingRef.current = false
      if (mountedRef.current) setDraft({ ...dirtyRef.current })
    }
    // oxlint-disable-next-line react/immutability
    if (Object.keys(dirtyRef.current).length) await flush()
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      void flush()
    }
  }, [flush])

  const set = useCallback((field: keyof LocalProfile, value: string) => {
    dirtyRef.current = { ...dirtyRef.current, [field]: value }
    setDraft(dirtyRef.current)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { void flush() }, SAVE_DELAY_MS)
  }, [flush])

  const get = (field: keyof LocalProfile) => draft[field] ?? profile[field] ?? ''

  return { get, set, flush }
}
