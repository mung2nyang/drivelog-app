// 운비서 그림 — 상황마다 그림 줄을 넘긴다. 움직임 줄이기를 켠 기기에서는 쉴 때 첫 칸만.
import { useEffect, useState, type CSSProperties } from 'react'
import { assetPath } from '../../../shared/utils/assetPath.ts'
import useFramePlayer, { type FrameStrip } from '../hooks/useFramePlayer.ts'
import useUnbiseoMotion, { type Situation } from '../hooks/useUnbiseoMotion.ts'
import type { UnbiseoAnswer } from '../hooks/useUnbiseoAssistant.ts'
import './unbiseo-avatar.css'

const STILL = assetPath('/images/unbiseo-rest-still.png')
const STRIPS: Record<Situation, FrameStrip & { src: string }> = {
  rest: { src: assetPath('/images/unbiseo-rest.webp'), frames: 21, seconds: 1.9, blend: 0.85 },
  listen: { src: assetPath('/images/unbiseo-listen.webp'), frames: 58, seconds: 2, blend: 0 },
  type: { src: assetPath('/images/unbiseo-type.webp'), frames: 26, seconds: 1, blend: 0.65 },
  talk: { src: assetPath('/images/unbiseo-talk.webp'), frames: 46, seconds: 1.1, blend: 0.7 },
}

// 다 받은 그림 줄 — 받기 전에는 멈춘 그림을 보여 빈칸이 생기지 않게 한다.
const loaded = new Set<string>()

function useLoaded(src: string) {
  const [, setCount] = useState(0)
  useEffect(() => {
    if (loaded.has(src)) return
    const image = new window.Image()
    image.onload = () => { loaded.add(src); setCount((count) => count + 1) }
    image.src = src
  }, [src])
  return loaded.has(src)
}

function prefersStill() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Props = {
  assistant: { speaking: boolean, answer: UnbiseoAnswer | null, busy: boolean, text: string, speech: { listening: boolean } },
  width: number,
  height: number,
}

export default function UnbiseoAvatar({ assistant, width, height }: Props) {
  const { speaking, answer, busy, text, speech } = assistant
  const { motion, done } = useUnbiseoMotion({ speaking, answer, busy, text, listening: speech.listening })
  const strip = STRIPS[motion.situation]
  const still = prefersStill()
  const ready = useLoaded(strip.src)
  const playing = ready && !still
  const { baseRef, topRef } = useFramePlayer(strip, motion.loops, motion.key, done, !playing)
  // 다른 상황 그림도 미리 받아 둔다.
  useEffect(() => {
    if (still) return
    for (const each of Object.values(STRIPS)) if (!loaded.has(each.src)) new window.Image().src = each.src
  }, [still])

  const layer = { backgroundImage: `url(${strip.src})`, backgroundSize: `${strip.frames * 100}% 100%` } as CSSProperties
  return (
    <span className={`unbiseo-avatar${playing ? ' playing' : ''}`} data-situation={motion.situation}>
      <img src={STILL} alt="" width={width} height={height} draggable={false} />
      {playing && <span ref={baseRef} className="unbiseo-avatar-layer" style={layer} aria-hidden="true" />}
      {playing && <span ref={topRef} className="unbiseo-avatar-layer top" style={layer} aria-hidden="true" />}
    </span>
  )
}
