// @ts-check
import { useEffect, useState } from 'react'
import { fetchMyInquiries } from '../api/supportInquiryMutations.js'
import { markShownAnswersSeen } from '../../../data/cloud/inquiryNotices.ts'
import { SkeletonLines } from '../../../shared/ui/Skeleton.tsx'
import { useToast } from '../../../shared/hooks/useToast.ts'

/** @typedef {import('../api/supportInquiryMutations.js').SupportInquiryRow} SupportInquiryRow */

const FETCH_FAIL_TOAST = '문의 목록을 불러오지 못했습니다.'

/**
 * @param {Object} props
 * @param {string} props.userId
 */
export default function MyInquiriesList({ userId }) {
  const showToast = useToast()
  const [result, setResult] = useState(/** @type {{ key: string, items: Array<SupportInquiryRow> }|null} */ (null))

  useEffect(() => {
    let cancelled = false
    fetchMyInquiries(userId)
      .then((rows) => {
        if (cancelled) return
        setResult({ key: userId, items: rows })
        void markShownAnswersSeen(rows)
      })
      .catch(() => {
        if (cancelled) return
        setResult({ key: userId, items: [] })
        showToast?.(FETCH_FAIL_TOAST)
      })
    return () => { cancelled = true }
  }, [userId, showToast])

  const loading = result?.key !== userId
  const items = result && !loading ? result.items : []

  if (loading) return <SkeletonLines lines={3} label="문의 목록을 불러오는 중…" />
  if (!items.length) return <div className="support-panel-empty">아직 접수한 문의나 건의가 없습니다.</div>

  return (
    <div className="my-inquiries-list">
      {items.map((inquiry) => {
        const answered = !!inquiry.answer
        const dateText = inquiry.created_at
          ? new Date(inquiry.created_at).toLocaleDateString('ko-KR')
          : ''
        return (
          <div key={inquiry.id} className="my-inquiry-card">
            <div className="my-inquiry-head">
              <span className="my-inquiry-type">{inquiry.type || '문의'}</span>
              <span className={`my-inquiry-status ${answered ? 'answered' : 'pending'}`}>
                {answered ? '답변 완료' : '답변 대기'}
              </span>
            </div>
            <strong className="my-inquiry-title">{inquiry.title || ''}</strong>
            <p className="my-inquiry-content">{inquiry.content || ''}</p>
            {dateText ? <div className="my-inquiry-date">{dateText}</div> : null}
            {answered ? (
              <div className="my-inquiry-answer">
                <span className="my-inquiry-answer-label">운영자 답변</span>
                <p>{inquiry.answer}</p>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
