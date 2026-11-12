/** @typedef {import('../data/sync/syncTypes.ts').AppSession} AppSession */

const GUEST_MODE_STORAGE_KEY = 'reactPracticeGuestMode'

/** @type {AppSession} */
export const GUEST_APP_SESSION = {
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

/** @param {boolean} active */
export function setGuestModePersisted(active) {
  try {
    if (active) localStorage.setItem(GUEST_MODE_STORAGE_KEY, '1')
    else localStorage.removeItem(GUEST_MODE_STORAGE_KEY)
  } catch {
  }
}

export function clearGuestModePersisted() {
  setGuestModePersisted(false)
}
