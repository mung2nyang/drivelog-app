import { getTaxInvoiceFlowMeta, getTaxInvoiceSupplierBiz } from '../../../domain/financeTaxInvoiceEntries.ts'
import { buildTaxInvoiceSheetData } from './taxInvoiceSheetData.ts'
import type { Sheet, SheetData } from 'write-excel-file/universal'
import type { InvoiceLike } from '../../../domain/financeTaxInvoiceEntries.ts'
import type { FinanceSettings } from '../../../domain/financeTypes.ts'
import type { TaxSheetParty } from './taxInvoiceSheetData.ts'

type TaxProfile = { bankName?: string, accountNumber?: string, name?: string }

const UPLOAD_HEADERS = ['작성일자', '공급자등록번호', '공급자상호', '공급자대표자', '공급자주소', '공급자업태', '공급자종목', '공급자이메일', '공급받는자등록번호', '공급받는자상호', '공급받는자대표자', '공급받는자주소', '공급받는자업태', '공급받는자종목', '공급받는자이메일', '품목', '수량', '공급가액', '세액', '합계금액', '비고']
const MONEY_COLUMNS = [17, 18, 19]

function partiesOf(item: InvoiceLike, settings: FinanceSettings): { supplier: TaxSheetParty, buyer: TaxSheetParty } {
  const biz = getTaxInvoiceSupplierBiz(item, settings)
  return {
    supplier: {
      bizNumber: biz.bizNumber || '',
      name: biz.name || '',
      representative: biz.representative || '',
      address: biz.address || '',
      bizType: biz.bizType || '',
      bizItem: biz.bizItem || '',
      email: biz.email || '',
    },
    buyer: {
      bizNumber: item.clientBizNumber || '',
      name: item.clientName || '',
      representative: item.clientRepresentative || '',
      address: item.clientAddress || '',
      bizType: item.clientBizType || '',
      bizItem: item.clientBizItem || '',
      email: item.clientEmail || '',
    },
  }
}

function buildUploadSheetData(values: Array<string | number | undefined>): SheetData {
  const header = UPLOAD_HEADERS.map((value) => ({ value, fontFamily: '맑은 고딕', fontSize: 10, fontWeight: 'bold' as const, textColor: '#FFFFFF', backgroundColor: '#365B9D' }))
  const row = values.map((value, index) => (MONEY_COLUMNS.includes(index) && typeof value === 'number' ? { value, format: '#,##0' } : value))
  return [header, row]
}

export function buildTaxInvoiceSheets(item: InvoiceLike, settings: FinanceSettings, profile: TaxProfile, monthKey: string): Array<Sheet<Blob>> {
  const { supplier, buyer } = partiesOf(item, settings)
  const issueDate = item.issueDate || `${monthKey}-01`
  const itemName = item.itemName || getTaxInvoiceFlowMeta().itemName
  const uploadValues = [issueDate, supplier.bizNumber, supplier.name, supplier.representative, supplier.address, supplier.bizType, supplier.bizItem, supplier.email, buyer.bizNumber, buyer.name, buyer.representative, buyer.address, buyer.bizType, buyer.bizItem, buyer.email, itemName, 1, Number(item.supplyAmount), Number(item.taxAmount), Number(item.totalAmount), item.remark]
  return [
    {
      sheet: '세금계산서',
      data: buildTaxInvoiceSheetData({ item, settings, profile, supplier, buyer, issueDate }),
      columns: [5, 10, 18, 10, 14, 5, 10, 18, 10, 14].map((width) => ({ width })),
      orientation: 'landscape',
      showGridLines: false,
    },
    {
      sheet: '입력자료',
      data: buildUploadSheetData(uploadValues),
      columns: UPLOAD_HEADERS.map((_, index) => ({ width: index === 0 ? 13 : 18 })),
      stickyRowsCount: 1,
    },
  ]
}

export async function buildTaxInvoiceExcelBlob(item: InvoiceLike, settings: FinanceSettings, profile: TaxProfile, monthKey: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/universal')
  return writeXlsxFile(buildTaxInvoiceSheets(item, settings, profile, monthKey)).toBlob()
}
