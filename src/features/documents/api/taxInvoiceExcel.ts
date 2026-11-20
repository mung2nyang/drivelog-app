import { getTaxInvoiceFlowMeta } from '../../../domain/financeTaxInvoiceEntries.ts'
import { buildTaxInvoiceExcelBlob } from './taxInvoiceWorkbookData.ts'
import { saveFileToDevice } from '../../../shared/utils/saveFile.ts'
import type { InvoiceLike } from '../../../domain/financeTaxInvoiceEntries.ts'
import type { FinanceSettings } from '../../../domain/financeTypes.ts'

export function buildTaxInvoiceExcelFileName(monthKey: string, item: InvoiceLike) {
  const label = getTaxInvoiceFlowMeta().label
  return `${monthKey}_${item.clientName || ''}_${label}_계산서.xlsx`.replace(/[\\/:*?"<>|]/g, '_')
}

export async function exportTaxInvoiceExcel(item: InvoiceLike, settings: FinanceSettings, profile: { bankName?: string, accountNumber?: string, name?: string }, monthKey: string) {
  const blob = await buildTaxInvoiceExcelBlob(item, settings, profile, monthKey)
  return saveFileToDevice(blob, buildTaxInvoiceExcelFileName(monthKey, item))
}
