import type { CallDetailLike as DomainCallDetailLike } from '../../../domain/callDetail.ts'
import type { normalizeSettings } from '../../../domain/practiceSettings.ts'

export type { ClientLike } from '../../../domain/clientTypes.ts'
export type { ExpenseItem } from '../../../domain/expenseTypes.ts'

export type Settings = ReturnType<typeof normalizeSettings>

export type CallDetailLike = DomainCallDetailLike & { id: string }

export type PaymentSummary = {
  paidAmount: number
  remainingAmount: number
  status: 'paid'|'partial'|'unpaid'
}
