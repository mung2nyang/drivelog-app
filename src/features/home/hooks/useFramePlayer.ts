import { useEffect, useRef } from 'react'

export type FrameStrip = { frames: number, seconds: number, blend: number }

export function framePosition(index: number, frames: number) {
  return frames > 1 ? (index / (frames - 1)) * 100 : 0
}

export function frameTiming(strip: FrameStrip) {
  const tick = (strip.seconds * 1000) / strip.frames
  return { tick, fade: Math.round(tick * strip.blend) }
}

export default function useFramePlayer(strip: FrameStrip, loops: 'infinite' | 2, playKey: string, onDone: () => void, still: boolean) {
  const baseRef = useRef<HTMLSpanElement>(null)
  const topRef = useRef<HTMLSpanElement>(null)
  const doneRef = useRef(onDone)
  useEffect(() => { doneRef.current = onDone }, [onDone])

  useEffect(() => {
    const base = baseRef.current
    const top = topRef.current
    if (!base || !top) return undefined
    const { tick, fade } = frameTiming(strip)
    const show = (layer: HTMLSpanElement, index: number) => { layer.style.backgroundPosition = `${framePosition(index, strip.frames)}% 0` }
    const hideTop = () => { top.style.transition = 'none'; top.style.opacity = '0' }
    show(base, 0)
    hideTop()
    if (still) return undefined
    let index = 0
    let played = 0
    let settle: ReturnType<typeof setTimeout> | undefined
    const timer = setInterval(() => {
      const next = (index + 1) % strip.frames
      if (next === 0) {
        played += 1
        if (loops !== 'infinite' && played >= loops) { clearInterval(timer); doneRef.current(); return }
      }
      index = next
      if (!fade) { show(base, next); return }
      clearTimeout(settle)
      show(top, next)
      hideTop()
      void top.offsetWidth
      top.style.transition = `opacity ${fade}ms linear`
      top.style.opacity = '1'
      settle = setTimeout(() => { show(base, next); hideTop() }, fade)
    }, tick)
    return () => { clearInterval(timer); clearTimeout(settle) }
  }, [strip, loops, playKey, still])

  return { baseRef, topRef }
}
