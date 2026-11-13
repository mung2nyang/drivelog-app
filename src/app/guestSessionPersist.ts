import type { AppSession } from '../data/sync/syncTypes.ts'

const GUEST_MODE_STORAGE_KEY = 'reactPracticeGuestMode'

export const GUEST_APP_SESSION: AppSession = {
  name: '비회원',
  accountType: 'owner_driver',
  guestMode: true,
}

export function isGuestModePersisted() {
  try {
    return localStorage.getItem(GUEST_MODE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setGuestModePersisted(active: boolean) {
  try {
    if (active) localStorage.setItem(GUEST_MODE_STORAGE_KEY, '1')
    else localStorage.removeItem(GUEST_MODE_STORAGE_KEY)
  } catch {
  }
}

export function clearGuestModePersisted() {
  setGuestModePersisted(false)
}
