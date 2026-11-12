import type { JsonValue } from '../../../domain/jsonTypes.ts'

export type QuestionType = 'revenue' | 'netProfit' | 'expense' | 'unpaid' | 'trips' | 'other'
export type QuestionPeriod = { unit: 'day', value: string } | { unit: 'month', value: string } | { unit: 'year', value: string } | { unit: 'all' } | { unit: 'unsupported' }
export type UnbiseoQuestion = { type: QuestionType, period: QuestionPeriod, client: string, expenseType: 'maint' | 'fuel' | 'misc' | '' }
export type QuestionNumbers = { amount: number, count: number, supply: number, withSub?: boolean }

const TYPES: Array<QuestionType> = ['revenue', 'netProfit', 'expense', 'unpaid', 'trips', 'other']
export const ASK_BY_MONTH = '월별 또는 연도별로 물어봐 주세요. 예: 이번 달 매출은 얼마야?'
export const CANNOT_ANSWER = '아직 답변할 수 없는 질문이에요. 매출, 순이익, 지출, 미수금 또는 운행 횟수를 물어봐 주세요.'
export const CLIENT_ONLY_SALES = '거래처별로는 매출과 미수금만 답할 수 있어요.'
export const NET_PROFIT_BY_MONTH = '순이익은 월별 또는 연도별로 물어봐 주세요.'
export const CLIENT_SALES_BY_MONTH = '거래처별 매출은 월별 또는 연도별로 물어봐 주세요.'

function formatWon(amount: number): string {
  return `${(Number(amount) || 0).toLocaleString('ko-KR')}원`
}

function textOf(value: JsonValue | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function periodOf(value: JsonValue | undefined, type: QuestionType, today: string): QuestionPeriod {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value : null
  const unit = row?.unit
  const key = textOf(row?.value)
  if (unit === 'unsupported') return { unit: 'unsupported' }
  if (unit === 'all') return { unit: 'all' }
  if (unit === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(key)) return { unit: 'day', value: key }
  if (unit === 'year' && /^\d{4}$/.test(key)) return { unit: 'year', value: key }
  if (unit === 'month' && /^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return { unit: 'month', value: key }
  return type === 'unpaid' ? { unit: 'all' } : { unit: 'month', value: today.slice(0, 7) }
}

export function readQuestion(row: { [key: string]: JsonValue }, today: string): UnbiseoQuestion {
  const type = TYPES.find((item) => item === row.type) ?? 'other'
  const kind = row.expenseType
  return {
    type,
    period: periodOf(row.period, type, today),
    client: textOf(row.client),
    expenseType: type === 'expense' && (kind === 'maint' || kind === 'fuel' || kind === 'misc') ? kind : '',
  }
}

function periodLabel(period: QuestionPeriod, today: string): string {
  if (period.unit === 'year') return `${period.value}년`
  if (period.unit === 'day') {
    if (period.value === today) return '오늘'
    const date = `${Number(period.value.slice(5, 7))}월 ${Number(period.value.slice(8, 10))}일`
    return period.value.slice(0, 4) === today.slice(0, 4) ? date : `${period.value.slice(0, 4)}년 ${date}`
  }
  if (period.unit !== 'month') return ''
  const month = `${Number(period.value.slice(5, 7))}월`
  return period.value.slice(0, 4) === today.slice(0, 4) ? month : `${period.value.slice(0, 4)}년 ${month}`
}

export function questionNotice(question: UnbiseoQuestion): string | null {
  if (question.type === 'other') return CANNOT_ANSWER
  if (question.period.unit === 'unsupported') return ASK_BY_MONTH
  if (question.period.unit === 'all' && question.type !== 'unpaid') return ASK_BY_MONTH
  if (question.client && question.type !== 'revenue' && question.type !== 'unpaid') return CLIENT_ONLY_SALES
  if (question.period.unit === 'day' && question.type === 'netProfit') return NET_PROFIT_BY_MONTH
  if (question.period.unit === 'day' && question.type === 'revenue' && question.client) return CLIENT_SALES_BY_MONTH
  return null
}

const EXPENSE_TOPIC = { '': '지출은', fuel: '주유비는', maint: '정비비는', misc: '기타 지출은' }

export function describeQuestion(question: UnbiseoQuestion, today: string, isDriver: boolean, numbersFor: (question: UnbiseoQuestion) => QuestionNumbers): string {
  const notice = questionNotice(question)
  if (notice) return notice
  const { amount, count, supply, withSub } = numbersFor(question)
  const label = periodLabel(question.period, today)
  if (question.type === 'unpaid') {
    const prefix = [question.client, label && `${label} 운행분`].filter(Boolean).join(' ')
    const head = prefix ? `${prefix} ` : ''
    return amount > 0 ? `${head}남은 미수금은 ${formatWon(amount)}입니다. ${withSub ? '기사 차량을 포함해 ' : ''}${count}건입니다.` : `${head}남은 미수금이 없습니다.`
  }
  if (question.type === 'revenue' && question.client) {
    if (count === 0) return `${question.client} ${label} 매출이 없습니다.`
    return `${question.client}의 ${label} 매출은 공급가액 기준 ${formatWon(supply)}이며, 부가가치세를 포함하면 ${formatWon(amount)}입니다.`
  }
  if (question.type === 'trips') return `${label} 운행은 ${count}회입니다.`
  if (question.type === 'expense') return `${label} ${EXPENSE_TOPIC[question.expenseType]} ${formatWon(amount)}입니다.`
  if (question.type === 'revenue' && question.period.unit === 'day') return amount > 0 ? `${label} 운송료는 ${formatWon(amount)}입니다.` : `${label} 운송료가 없습니다.`
  if (question.type === 'netProfit') return `${label} ${isDriver ? '정산액은' : '순이익은'} ${formatWon(amount)}입니다.`
  return `${label} ${isDriver ? '정산 전 운송 수입은' : '매출은'} ${formatWon(amount)}입니다.`
}
