import { useEffect, type CSSProperties } from 'react'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import { useOwnerSettings } from '../../../data/store/ownerDataHooks.ts'
import { useUnbiseo } from '../hooks/unbiseoContext.ts'
import { useDockPosition } from '../hooks/useDockPosition.ts'
import HomeAssistantPanel from './HomeAssistantPanel.tsx'
import UnbiseoAvatar from './UnbiseoAvatar.tsx'
import './home-assistant.css'
import './unbiseo-dock.css'

export default function UnbiseoDock() {
  const { assistant, openCall, dockOpen, setDockOpen } = useUnbiseo()
  const { speech } = assistant
  const { position, offset, fabRef, bind, justDragged } = useDockPosition()
  const { ownerKey } = useSession()
  const dockOn = useOwnerSettings(ownerKey).unbiseoDockOn !== false
  useEffect(() => {
    if (dockOn) return
    setDockOpen(false)
    if (speech.listening) speech.stop()
  }, [dockOn, setDockOpen, speech])
  if (!assistant.loggedIn || !dockOn) return null

  function openAndListen() {
    setDockOpen(true)
    if (speech.supported && !speech.listening && !assistant.busy) speech.start()
  }

  if (!dockOpen) {
    const place = { '--dock-lift': `${position.lift}px` } as CSSProperties
    const moving = offset ? { transform: `translate(${offset[0]}px, ${offset[1]}px)` } : undefined
    return (
      <section className={`unbiseo-dock${position.side === 'left' ? ' left' : ''}`} style={place} aria-label="AI 운비서">
        <button
          {...bind()}
          ref={fabRef}
          type="button"
          className="unbiseo-dock-fab"
          style={moving}
          aria-label="AI 운비서 열기"
          aria-expanded={false}
          onClick={() => { if (!justDragged()) openAndListen() }}
        >
          <UnbiseoAvatar assistant={assistant} width={45} height={32} />
        </button>
      </section>
    )
  }

  return (
    <section className="unbiseo-dock open" aria-label="AI 운비서">
      <div className="unbiseo-dock-card">
        <div className="home-assistant-head unbiseo-dock-head">
          <span className="home-assistant-avatar">
            <UnbiseoAvatar assistant={assistant} width={53} height={37} />
          </span>
          <strong className="home-assistant-name unbiseo-dock-name">AI 운비서</strong>
          {speech.supported && (
            <button
              type="button"
              className={`home-assistant-mic-btn${speech.listening ? ' listening' : ''}`}
              aria-label={speech.listening ? '듣기 멈추기' : '말하기'}
              disabled={assistant.busy}
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="9" y="2" width="6" height="12" rx="3"></rect>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
              </svg>
            </button>
          )}
          <button type="button" className="unbiseo-dock-close" aria-label="작게" aria-expanded onClick={() => { if (speech.listening) speech.stop(); setDockOpen(false) }}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
        <HomeAssistantPanel assistant={assistant} onOpenCall={openCall} />
      </div>
    </section>
  )
}
