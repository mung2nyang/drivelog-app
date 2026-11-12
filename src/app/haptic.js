// @ts-check
export const BUZZ_MS = 10

/** @param {{ vibrate?: (pattern: number) => boolean } | undefined} [nav] */
export function buzz(nav = globalThis.navigator) {
  try {
    if (nav && typeof nav.vibrate === 'function') nav.vibrate(BUZZ_MS)
  } catch {
  }
}
