import { getTaxInvoiceFlowMeta, getTaxInvoiceSupplierBiz } from '../../../domain/financeTaxInvoiceEntries.ts'
import { drawTaxInvoiceSheet } from './taxInvoiceSheet.ts'
import { styleTaxInvoiceSheet } from './taxInvoiceSheetStyle.ts'
import type { InvoiceLike } from '../../../domain/financeTaxInvoiceEntries.ts'
import type { FinanceSettings } from '../../../domain/financeTypes.ts'

export function buildTaxInvoiceWorkbook(ExcelJS: typeof import('exceljs'), item: InvoiceLike, settings: FinanceSettings, profile: { bankName?: string, accountNumber?: string, name?: string }, monthKey: string) {
  const resolvedSupplierBiz = getTaxInvoiceSupplierBiz(item, settings)
  const companyParty = {
    bizNumber: resolvedSupplierBiz.bizNumber || '',
    name: resolvedSupplierBiz.name || '',
    representative: resolvedSupplierBiz.representative || '',
    address: resolvedSupplierBiz.address || '',
    bizType: resolvedSupplierBiz.bizType || '',
    bizItem: resolvedSupplierBiz.bizItem || '',
    email: resolvedSupplierBiz.email || '',
  }
  const otherParty = {
    bizNumber: item.clientBizNumber || '',
    name: item.clientName || '',
    representative: item.clientRepresentative || '',
    address: item.clientAddress || '',
    bizType: item.clientBizType || '',
    bizItem: item.clientBizItem || '',
    email: item.clientEmail || '',
  }
  const supplier = companyParty
  const buyer = otherParty
  const issueDate = item.issueDate || `${monthKey}-01`
  const flowMeta = getTaxInvoiceFlowMeta()

  const workbook = new ExcelJS.Workbook()
  workbook.creator = settings.bizName || '운행일지'
  workbook.created = new Date()
  workbook.subject = `${monthKey} ${item.itemName || flowMeta.itemName}`

  const sheet = drawTaxInvoiceSheet(workbook, { item, settings, profile, supplier, buyer, issueDate })
  styleTaxInvoiceSheet(sheet)

  const uploadSheet = workbook.addWorksheet('입력자료', { views: [{ state: 'frozen', ySplit: 1 }] })
  const uploadHeaders = ['작성일자', '공급자등록번호', '공급자상호', '공급자대표자', '공급자주소', '공급자업태', '공급자종목', '공급자이메일', '공급받는자등록번호', '공급받는자상호', '공급받는자대표자', '공급받는자주소', '공급받는자업태', '공급받는자종목', '공급받는자이메일', '품목', '수량', '공급가액', '세액', '합계금액', '비고']
  const uploadRow = [issueDate, supplier.bizNumber, supplier.name, supplier.representative, supplier.address, supplier.bizType, supplier.bizItem, supplier.email, buyer.bizNumber, buyer.name, buyer.representative, buyer.address, buyer.bizType, buyer.bizItem, buyer.email, item.itemName || flowMeta.itemName, 1, Number(item.supplyAmount), Number(item.taxAmount), Number(item.totalAmount), item.remark]
  uploadSheet.addRow(uploadHeaders)
  uploadSheet.addRow(uploadRow)
  uploadSheet.getRow(1).font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  uploadSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF365B9D' } }
  uploadSheet.columns.forEach((column, index) => { column.width = index === 0 ? 13 : 18 })
  ;[18, 19, 20].forEach((col) => { uploadSheet.getCell(2, col).numFmt = '#,##0' })

  return workbook
}
