import { requestClientTaxInfo } from '../../../data/sync/clientMutations.ts'
import { getCloudUserId } from '../../../data/cloud/cloudSession.ts'
import { getTaxInvoiceFlowMeta } from '../../../domain/finance.ts'
import { invoiceCanIssue, persistInvoiceRecord } from '../../../domain/invoices.ts'
import { SERVER_SAVE_FAIL } from '../../../shared/utils/failureMessages.ts'
import type { ClientLike } from '../../../domain/clientTypes.ts'
import type { InvoiceLike } from '../../../domain/financeTaxInvoiceEntries.ts'
import type { FinanceSettings } from '../../../domain/financeTypes.ts'

const SAVE_FAIL_TOAST = SERVER_SAVE_FAIL

async function saveSucceeded(save: () => Promise<void>, label: string): Promise<boolean> {
  try {
    await save()
    return true
  } catch (error) {
    console.error(`[taxInvoiceActions] ${label} 저장 실패:`, error)
    return false
  }
}

export function checkTaxInvoiceDraft(item: InvoiceLike): { field: 'clientBizNumber'|'issueDate', message: string }|null {
  if (!item.clientBizNumber) return { field: 'clientBizNumber', message: '사업자등록번호를 입력해 주세요.' }
  if (!item.issueDate) return { field: 'issueDate', message: '작성일자를 입력해 주세요.' }
  return null
}

type SaveTaxInvoiceDraftProps = {
  ownerKey: string
  clients: Array<ClientLike>
  records: Array<InvoiceLike>
  modalItem: InvoiceLike
  persist: (next: Array<InvoiceLike>) => Promise<void>
  showToast?: (message: string) => void
}

export async function saveTaxInvoiceDraft({ ownerKey, clients, records, modalItem, persist, showToast }: SaveTaxInvoiceDraftProps): Promise<boolean> {
  const problem = checkTaxInvoiceDraft(modalItem)
  if (problem) {
    showToast?.(problem.message)
    return false
  }
  const nextItem = { ...modalItem, updatedAt: new Date().toISOString() }
  if (nextItem.partyType === 'client') {
    const taxResult = await requestClientTaxInfo({
      ownerKey,
      userId: getCloudUserId(),
      clients,
      companyName: nextItem.clientName || '',
      patch: {
        bizNumber: nextItem.clientBizNumber,
        taxRepresentative: nextItem.clientRepresentative,
        taxEmail: nextItem.clientEmail,
        taxAddress: nextItem.clientAddress,
        taxBizType: nextItem.clientBizType,
        taxBizItem: nextItem.clientBizItem,
      },
    })
    if (taxResult.failed) {
      if (taxResult.toast) showToast?.(taxResult.toast)
      return false
    }
  }
  if (!await saveSucceeded(() => persist(persistInvoiceRecord(records, nextItem)), '작성 내용')) {
    showToast?.(SAVE_FAIL_TOAST)
    return false
  }
  showToast?.('세금계산서 작성 내용을 저장했습니다.')
  return true
}

type ChangeTaxInvoiceStatusProps = {
  item: InvoiceLike
  status: 'draft'|'issued'
  settings: FinanceSettings
  records: Array<InvoiceLike>
  persist: (next: Array<InvoiceLike>) => Promise<void>
  openDraft: (item: InvoiceLike) => void
  showToast?: (message: string) => void
}

export async function changeTaxInvoiceStatus({ item, status, settings, records, persist, openDraft, showToast }: ChangeTaxInvoiceStatusProps): Promise<void> {
  if (status === 'issued') {
    const check = invoiceCanIssue(item, settings)
    if (!check.ok) {
      showToast?.(check.error || '발급할 수 없습니다.')
      if (check.needDraft) openDraft(item)
      return
    }
  }
  const saved = await saveSucceeded(() => persist(persistInvoiceRecord(records, {
    ...item,
    status,
    issuedAt: status === 'issued' ? new Date().toISOString() : '',
  })), '발급 상태')
  if (!saved) {
    showToast?.(SAVE_FAIL_TOAST)
    return
  }
  showToast?.(status === 'issued' ? `${getTaxInvoiceFlowMeta().completeLabel}로 표시했습니다.` : '처리 전 상태로 되돌렸습니다.')
}
