export type Json = string | number | boolean | null | Array<Json> | { [key: string]: Json }
export type QuestionType = 'revenue' | 'netProfit' | 'expense' | 'unpaid' | 'trips' | 'other'
export type Period = { unit: 'day', value: string } | { unit: 'month', value: string } | { unit: 'year', value: string } | { unit: 'all' } | { unit: 'unsupported' }
export type Question = { type: QuestionType, period: Period, client: string, expenseType: 'maint' | 'fuel' | 'misc' | '' }

const TYPES: Array<QuestionType> = ['revenue', 'netProfit', 'expense', 'unpaid', 'trips', 'other']

function typeOf(value: Json | undefined): QuestionType {
  return TYPES.find((type) => type === value) ?? 'other'
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

function periodOf(unit: Json | undefined, value: Json | undefined, type: QuestionType, today: string): Period {
  const thisMonth = today.slice(0, 7)
  const thisYear = today.slice(0, 4)
  if (unit === 'unsupported') return { unit: 'unsupported' }
  if (unit === 'all') return { unit: 'all' }
  if (unit === 'day' && typeof value === 'string' && isDateKey(value)) return { unit: 'day', value: value > today ? today : value }
  if (unit === 'year' && typeof value === 'string' && /^\d{4}$/.test(value)) {
    return { unit: 'year', value: value > thisYear ? thisYear : value }
  }
  if (unit === 'month' && typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    if (value <= thisMonth) return { unit: 'month', value }
    const month = value.slice(5)
    const year = month <= today.slice(5, 7) ? Number(thisYear) : Number(thisYear) - 1
    return { unit: 'month', value: `${year}-${month}` }
  }
  return type === 'unpaid' ? { unit: 'all' } : { unit: 'month', value: thisMonth }
}

export function readQuestion(row: { [key: string]: Json }, today: string, client: string): Question {
  const type = typeOf(row.questionType)
  const kind = row.questionExpenseType
  return {
    type,
    period: periodOf(row.periodUnit, row.periodValue, type, today),
    client,
    expenseType: type === 'expense' && (kind === 'maint' || kind === 'fuel' || kind === 'misc') ? kind : '',
  }
}
