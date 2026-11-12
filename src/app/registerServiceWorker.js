// @ts-check

/**
 * @param {{ prod: boolean, base: string, nav?: { serviceWorker?: { register: (url: string, options: { scope: string }) => Promise<ServiceWorkerRegistration|void> } } }} env
 * @returns {Promise<boolean>}
 */
export async function registerServiceWorker({ prod, base, nav }) {
  if (!prod || !nav?.serviceWorker) return false
  try {
    await nav.serviceWorker.register(`${base}sw.js`, { scope: base })
    return true
  } catch {
    return false
  }
}
