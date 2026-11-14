import { getTaxInvoiceFlowMeta } from '../../../domain/financeTaxInvoiceEntries.ts'
import { buildTaxInvoiceWorkbook } from './taxInvoiceExcelBuilder.ts'
import { saveFileToDevice } from '../../../shared/utils/saveFile.ts'
import type { InvoiceLike } from '../../../domain/financeTaxInvoiceEntries.ts'
import type { FinanceSettings } from '../../../domain/financeTypes.ts'

export function buildTaxInvoiceExcelFileName(monthKey: string, item: InvoiceLike) {
  const label = getTaxInvoiceFlowMeta().label
  return `${monthKey}_${item.clientName || ''}_${label}_계산서.xlsx`.replace(/[\\/:*?"<>|]/g, '_')
}

export async function exportTaxInvoiceExcel(item: InvoiceLike, settings: FinanceSettings, profile: { bankName?: string, accountNumber?: string, name?: string }, monthKey: string) {
  const mod = await import('exceljs')
  const ExcelJS = (mod.default || mod) as typeof import('exceljs')
  const workbook = buildTaxInvoiceWorkbook(ExcelJS, item, settings, profile, monthKey)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  return saveFileToDevice(blob, buildTaxInvoiceExcelFileName(monthKey, item))
}
