// @ts-check
const KEY = 'chunkReloadAt'
export const CHUNK_RELOAD_WINDOW_MS = 10000

/**
 * @param {{ addEventListener: (type: string, listener: (event: Event) => void) => void, location: { reload: () => void } }} win
 * @param {{ getItem: (key: string) => string|null, setItem: (key: string, value: string) => void }} storage
 * @param {() => number} [now]
 */
export function installChunkReload(win, storage, now = Date.now) {
  win.addEventListener('vite:preloadError', (event) => {
    let last = 0
    try {
      last = Number(storage.getItem(KEY)) || 0
    } catch {
      last = 0
    }
    if (now() - last < CHUNK_RELOAD_WINDOW_MS) return
    try {
      storage.setItem(KEY, String(now()))
    } catch {
      return
    }
    event.preventDefault()
    win.location.reload()
  })
}
