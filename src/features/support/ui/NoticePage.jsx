// @ts-check
import { useState } from 'react'
import PageHeader from '../../../shared/ui/PageHeader.tsx'
import './customer-center.css'

/** @type {Array<{ title: string, date: string, body: string }>} */
const NOTICES = [
  {
    title: '운비서 하루 이용 횟수 안내',
    date: '2026.11.04',
    body: 'AI 운비서는 계정마다 하루 20번까지 쓸 수 있습니다. 횟수는 매일 밤 12시(한국 시각)\u2060에 리셋 됩니다.',
  },
]

/**
 * @param {Object} props
 * @param {() => void} [props.onBack]
 * @param {(() => void)} [props.onOpenMenu]
 */
export default function NoticePage({ onBack, onOpenMenu }) {
  const [openIndex, setOpenIndex] = useState(/** @type {number|null} */ (null))

  /** @param {number} index */
  function toggle(index) {
    setOpenIndex((prev) => (prev === index ? null : index))
  }

  return (
    <div className="page notice-page">
      <PageHeader title="공지사항" onBack={onBack} onOpenMenu={onOpenMenu} />

      <section className="support-panel" aria-label="공지사항">
        {NOTICES.length === 0 && <div className="empty-state">등록된 공지사항이 없습니다.</div>}
        {NOTICES.map((notice, index) => (
          <button
            key={notice.title}
            type="button"
            className={`faq-item${openIndex === index ? ' open' : ''}`}
            onClick={() => toggle(index)}
          >
            <span>{notice.title} ({notice.date})</span>
            <i>{openIndex === index ? '−' : '+'}</i>
            <div className="support-detail">{notice.body}</div>
          </button>
        ))}
      </section>
    </div>
  )
}
