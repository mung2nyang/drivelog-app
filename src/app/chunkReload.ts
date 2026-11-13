const KEY = 'chunkReloadAt'
export const CHUNK_RELOAD_WINDOW_MS = 10000

type ReloadWindow = { addEventListener: (type: string, listener: (event: Event) => void) => void, location: { reload: () => void } }
type ReloadStorage = { getItem: (key: string) => string | null, setItem: (key: string, value: string) => void }

export function installChunkReload(win: ReloadWindow, storage: ReloadStorage, now: () => number = Date.now) {
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
