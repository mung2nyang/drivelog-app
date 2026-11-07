// 운비서 그림 — 쉴 때는 멈춘 그림, 말하는 동안은 동작 그림을 넘긴다.
import { useEffect, type CSSProperties } from 'react'
import { assetPath } from '../../../shared/utils/assetPath.js'
import useUnbiseoMotion, { MOTION_COUNT } from '../hooks/useUnbiseoMotion.ts'
import './unbiseo-avatar.css'

const STILL = assetPath('/images/assistant_unbiseo.png')
const MOTIONS = Array.from({ length: MOTION_COUNT }, (_, index) => assetPath(`/images/unbiseo-motion-${index + 1}.webp`))

type Props = {
  assistant: { speaking: boolean, answer: unknown, busy: boolean },
  width: number,
  height: number,
}

export default function UnbiseoAvatar({ assistant, width, height }: Props) {
  const { motion, done } = useUnbiseoMotion(assistant)
  // 처음 움직일 때 빈칸이 보이지 않게 동작 그림을 미리 받아 둔다.
  useEffect(() => {
    for (const src of MOTIONS) new window.Image().src = src
  }, [])

  return (
    <span className={`unbiseo-avatar${motion ? ' moving' : ''}`}>
      <img src={STILL} alt="" width={width} height={height} draggable={false} />
      {motion && (
        <img
          key={motion.key}
          className="unbiseo-avatar-strip"
          src={MOTIONS[motion.number - 1]}
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
