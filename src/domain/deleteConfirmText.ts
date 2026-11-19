import { KINDS, expenseTitle } from './expenses.ts'
import { formatWon } from './money.ts'
import type { CallDetailLike } from './callDetail.ts'
import type { ExpenseItem } from './expenseTypes.ts'

const CANNOT_UNDO = '삭제하면 되돌릴 수 없어요.'

export type DeleteConfirmText = { title: string, message: string, confirmLabel: string, cancelLabel: string, danger: true }

function deleteText(title: string, target: string): DeleteConfirmText {
  return { title, message: `${target} 내역을 삭제할까요? ${CANNOT_UNDO}`, confirmLabel: '삭제', cancelLabel: '취소', danger: true }
}

export function callDeleteText(detail: CallDetailLike): DeleteConfirmText {
  return deleteText('세부 내역 삭제', `${detail.loadLoc || '상차지 없음'} → ${detail.unloadLoc || '하차지 없음'}`)
}

export function expenseDeleteText(item: ExpenseItem): DeleteConfirmText {
  const kindLabel = KINDS.find((kind) => kind.value === item.kind)?.label || '지출'
  return deleteText(`${kindLabel} 내역 삭제`, `${expenseTitle(item, kindLabel)} ${formatWon(item.cost)}`)
}
