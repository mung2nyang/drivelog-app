// 알림용 문의 읽기 — 내 문의 중 아직 안 본 답변, 관리자면 답변 대기 건수. 답변을 "봤음"으로 저장(0035).
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

/** 본 시각이 답변 시각 이상이면 이미 본 답변(다시 답하면 답변 시각이 늦어져 안 본 것이 됨). */
export function isAnswerSeen(answeredAt: string, seenAt: string | null | undefined): boolean {
  const answered = Date.parse(answeredAt)
  const seen = Date.parse(String(seenAt || ''))
  return !Number.isNaN(answered) && !Number.isNaN(seen) && seen >= answered
}

/** 본인 문의 중 아직 안 본 답변만(최근 답변 먼저). 실패하면 던진다. */
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

/** 그 답변을 봤음으로 서버에 저장. 답변 시각이 바뀌었으면 서버가 저장하지 않는다(다시 뜸). 실패하면 던진다. */
export async function markInquiryAnswerSeen(inquiryId: string, answeredAt: string): Promise<void> {
  const { error } = await supabase.rpc('mark_inquiry_answer_seen', { p_inquiry_id: inquiryId, p_answered_at: answeredAt })
  if (error) throw new Error(error.message || '알림 저장에 실패했습니다.')
}

/** 나의 문의에 보인 답변 중 안 본 것을 모두 봤음으로. 실패한 것은 알림에 남는다(안내 없음). */
export async function markShownAnswersSeen(rows: Array<{ id: string, answer: string | null, answeredAt: string | null, answerSeenAt: string | null }>): Promise<void> {
  const unseen = rows.filter((row) => row.answer?.trim() && row.answeredAt && !isAnswerSeen(row.answeredAt, row.answerSeenAt))
  const results = await Promise.allSettled(unseen.map((row) => markInquiryAnswerSeen(row.id, (row.answeredAt) as string)))
  if (results.some((result) => result.status === 'rejected')) console.warn('[나의 문의] 답변 봤음 저장 실패 — 알림에 남습니다.')
}

/** 관리자 함수(0025)로 답변 대기 건수와 가장 최근 대기 문의. 0건이면 null, 실패하면 던진다. */
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
    // 서버가 답변 대기 먼저·최근 먼저로 주므로 처음 만난 대기 문의가 가장 최근.
    if (!latest) latest = { id, title: text(row, 'title') }
  }
  return latest ? { count, latestId: latest.id, latestTitle: latest.title } : null
}
