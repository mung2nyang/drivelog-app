import type { AnsweredInquiry, PendingInquirySummary } from '../../../data/cloud/inquiryNotices.ts'

export type InquiryNoticeData = { answered: Array<AnsweredInquiry>, pending: PendingInquirySummary | null }

export type InquiryNoticeItem = {
  id: string
  kind: string
  page: string
  title: string
  body: string
  dateLabel: string
  actionLabel?: string
  dismissLabel?: string
  inquiryId?: string
  answeredAt?: string
}

export const NO_INQUIRY_NOTICES: InquiryNoticeData = { answered: [], pending: null }

function shortLocalDate(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

export function buildInquiryNoticeItems(
  data: InquiryNoticeData,
  dismissed: Array<string>,
  off: Array<string>,
): Array<InquiryNoticeItem> {
  const items: Array<InquiryNoticeItem> = []
  for (const inquiry of data.answered) {
    const date = shortLocalDate(inquiry.answeredAt)
    items.push({
      id: `inquiryAnswer:${inquiry.id}:${inquiry.answeredAt}`,
      kind: 'inquiryAnswer',
      page: 'my-inquiries',
      title: '문의에 답변이 도착했습니다',
      body: inquiry.title || '문의',
      dateLabel: date ? `답변 ${date}` : '',
      inquiryId: inquiry.id,
      answeredAt: inquiry.answeredAt,
    })
  }
  if (data.pending) {
    items.push({
      id: `adminInquiry:${data.pending.latestId}`,
      kind: 'adminInquiry',
      page: 'admin',
      title: `답변 대기 문의 ${data.pending.count}건`,
      body: data.pending.latestTitle || '문의',
      dateLabel: '',
    })
  }
  return items.filter((item) => !dismissed.includes(item.id) && !off.includes(item.kind))
}
