export const BUZZ_MS = 10

export function buzz(nav: { vibrate?: (pattern: number) => boolean } | undefined = globalThis.navigator) {
  try {
    if (nav && typeof nav.vibrate === 'function') nav.vibrate(BUZZ_MS)
  } catch {
  }
}
