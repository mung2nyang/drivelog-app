// 운비서 그림 — 쉴 때는 멈춘 그림, 말하는 동안은 동작 그림을 넘긴다.
import { useEffect, type CSSProperties } from 'react'
import { assetPath } from '../../../shared/utils/assetPath.js'
import useUnbiseoMotion, { type MotionName } from '../hooks/useUnbiseoMotion.ts'
import './unbiseo-avatar.css'

const STILL = assetPath('/images/unbiseo-still.png')
const MOTIONS: Record<MotionName, string> = {
  blink: assetPath('/images/unbiseo-blink.webp'),
  smile: assetPath('/images/unbiseo-smile.webp'),
  'move-a': assetPath('/images/unbiseo-move-a.webp'),
  'move-b': assetPath('/images/unbiseo-move-b.webp'),
}

type Props = {
  assistant: { speaking: boolean, answer: unknown, busy: boolean, text: string, speech: { listening: boolean } },
  width: number,
  height: number,
}

export default function UnbiseoAvatar({ assistant, width, height }: Props) {
  const { speaking, answer, busy, text, speech } = assistant
  const { motion, done } = useUnbiseoMotion({ speaking, answer, busy, text, listening: speech.listening })
  // 처음 움직일 때 빈칸이 보이지 않게 동작 그림을 미리 받아 둔다.
  useEffect(() => {
    for (const src of Object.values(MOTIONS)) new window.Image().src = src
  }, [])

  return (
    <span className={`unbiseo-avatar${motion ? ' moving' : ''}`}>
      <img src={STILL} alt="" width={width} height={height} draggable={false} />
      {motion && (
        <img
          key={motion.key}
          className="unbiseo-avatar-strip"
          src={MOTIONS[motion.name]}
          alt=""
          draggable={false}
          style={{ '--motion-loops': motion.loops } as CSSProperties}
          onAnimationEnd={done}
          onError={done}
        />
      )}
    </span>
  )
}
