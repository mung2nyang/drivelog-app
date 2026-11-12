import type { JsonValue } from '../../domain/jsonTypes.ts'
import { supabase } from './supabaseClient.ts'

export type AnsweredInquiry = { id: string, title: string, answeredAt: string }
export type PendingInquirySummary = { count: number, latestId: string, latestTitle: string }

function record(row: JsonValue | undefined): { [key: string]: JsonValue } | null {
  return row && typeof row === 'object' && !Array.isArray(row) ? row : null
}

function text(row: { [key: string]: JsonValue }, key: string): string {
  const value = row[key]
  return typeof value === 'string' ? value : ''
}

export function isAnswerSeen(answeredAt: string, seenAt: string | null | undefined): boolean {
  const answered = Date.parse(answeredAt)
  const seen = Date.parse(String(seenAt || ''))
  return !Number.isNaN(answered) && !Number.isNaN(seen) && seen >= answered
}

export async function fetchMyAnsweredInquiries(userId: string): Promise<Array<AnsweredInquiry>> {
  const { data, error } = await supabase
    .from('support_inquiries')
    .select('id, title, answer, answered_at, answer_seen_at')
    .eq('user_id', userId)
    .order('answered_at', { ascending: false })
  if (error) throw new Error(error.message || '문의 조회에 실패했습니다.')
  const rows: Array<JsonValue> = Array.isArray(data) ? data : []
  const out: Array<AnsweredInquiry> = []
  for (const raw of rows) {
    const row = record(raw)
    const id = row ? row.id : null
    if (!row || typeof id !== 'string' || !id || !text(row, 'answer').trim()) continue
    if (isAnswerSeen(text(row, 'answered_at'), text(row, 'answer_seen_at'))) continue
    out.push({ id, title: text(row, 'title'), answeredAt: text(row, 'answered_at') })
  }
  return out
}

export async function markInquiryAnswerSeen(inquiryId: string, answeredAt: string): Promise<void> {
  const { error } = await supabase.rpc('mark_inquiry_answer_seen', { p_inquiry_id: inquiryId, p_answered_at: answeredAt })
  if (error) throw new Error(error.message || '알림 저장에 실패했습니다.')
}

export async function markShownAnswersSeen(rows: Array<{ id: string, answer: string | null, answeredAt: string | null, answerSeenAt: string | null }>): Promise<void> {
  const unseen = rows.filter((row) => row.answer?.trim() && row.answeredAt && !isAnswerSeen(row.answeredAt, row.answerSeenAt))
  const results = await Promise.allSettled(unseen.map((row) => markInquiryAnswerSeen(row.id, (row.answeredAt) as string)))
  if (results.some((result) => result.status === 'rejected')) console.warn('[나의 문의] 답변 봤음 저장 실패 — 알림에 남습니다.')
}

export async function fetchPendingInquirySummary(): Promise<PendingInquirySummary | null> {
  const { data, error } = await supabase.rpc('admin_list_support_inquiries')
  if (error) throw new Error(error.message || '문의 목록 조회에 실패했습니다.')
  const rows: Array<JsonValue> = Array.isArray(data) ? data : []
  let count = 0
  let latest: { id: string, title: string } | null = null
  for (const raw of rows) {
    const row = record(raw)
    const id = row ? row.id : null
    if (!row || typeof id !== 'string' || !id || text(row, 'answer').trim()) continue
    count += 1
    if (!latest) latest = { id, title: text(row, 'title') }
  }
  return latest ? { count, latestId: latest.id, latestTitle: latest.title } : null
}
