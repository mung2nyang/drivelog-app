import { useEffect, useState } from 'react'
import { getState, subscribe } from './app-store.ts'

export function useHydrationLock(): boolean {
  const [locked, setLocked] = useState(() => getState().hydration.status === 'hydrating')

  useEffect(() => subscribe((state) => setLocked(state.hydration.status === 'hydrating')), [])

  return locked
}
