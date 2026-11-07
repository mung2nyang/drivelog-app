// @ts-check
// 홈 운비서 줄 — 마이크를 한 번 누르면 카드가 늘어나며 바로 듣고, 나머지를 누르면 글로 쓰는 칸이 열린다. 이름 "운비서"는 임시.
import { useEffect, useState } from 'react'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import { useOwnerSettings } from '../../../data/store/ownerDataHooks.ts'
import { useUnbiseo } from '../hooks/unbiseoContext.ts'
import HomeAssistantPanel from './HomeAssistantPanel.tsx'
import UnbiseoAvatar from './UnbiseoAvatar.tsx'
import './home-assistant.css'

export default function HomeAssistantBar() {
  const [open, setOpen] = useState(false)
  const { assistant, openCall } = useUnbiseo()
  const { speech } = assistant
  const { ownerKey } = useSession()
  // 설정에서 운비서를 끄면 홈 카드도 그리지 않는다 — 듣던 중이면 멈춘다. 비회원은 끌 수 없어 늘 보인다.
  const hidden = useOwnerSettings(ownerKey).unbiseoDockOn === false && assistant.loggedIn
  useEffect(() => {
    if (hidden && speech.listening) speech.stop()
  }, [hidden, speech])
  if (hidden && open) setOpen(false)
  if (hidden) return null

  function onMic() {
    setOpen(true)
    if (!assistant.loggedIn) return
    if (speech.listening) speech.stop()
    else speech.start()
  }

  return (
    <section className={`home-card home-assistant${open ? ' open' : ''}`} aria-label="AI 운비서">
      <div className="home-assistant-head">
        <button type="button" className="home-assistant-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span className="home-assistant-avatar">
            <UnbiseoAvatar assistant={assistant} width={53} height={37} />
          </span>
          <span className="home-assistant-copy">
            <strong className="home-assistant-name">AI 운비서</strong>
          </span>
        </button>
        {speech.supported && (
          <button
            type="button"
            className={`home-assistant-mic-btn${speech.listening ? ' listening' : ''}`}
            aria-label={speech.listening ? '듣기 멈추기' : '말하기'}
            disabled={assistant.busy}
            onClick={onMic}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3"></rect>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
          </button>
        )}
      </div>
      {open && <HomeAssistantPanel assistant={assistant} onOpenCall={openCall} />}
    </section>
  )
}
