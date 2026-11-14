import { taxSheetFont } from './taxInvoiceSheetStyle.ts'
import type { Workbook, Worksheet } from 'exceljs'
import type { InvoiceLike } from '../../../domain/financeTaxInvoiceEntries.ts'
import type { FinanceSettings } from '../../../domain/financeTypes.ts'

export type TaxParty = { bizNumber: string, name: string, representative: string, address: string, bizType: string, bizItem: string, email: string }

type TaxSheetContent = {
  item: InvoiceLike
  settings: FinanceSettings
  profile: { bankName?: string, accountNumber?: string, name?: string }
  supplier: TaxParty
  buyer: TaxParty
  issueDate: string
}

export function drawTaxInvoiceSheet(workbook: Workbook, { item, settings, profile, supplier, buyer, issueDate }: TaxSheetContent): Worksheet {
  const sheet = workbook.addWorksheet('세금계산서', {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.1, footer: 0.1 },
    },
    views: [{ showGridLines: false }],
  })
  const widths = [5, 10, 18, 10, 14, 5, 10, 18, 10, 14]
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width })
  sheet.properties.defaultRowHeight = 21
  sheet.pageSetup.printArea = 'A1:J19'

  const supplierFill = 'FFFFFFFF'
  const supplierSectionFill = 'FFFFD9D9'
  const supplierLabelFill = 'FFFFF2F2'
  const buyerFill = 'FFFFFFFF'
  const buyerSectionFill = 'FFC2D9F2'
  const buyerLabelFill = 'FFF2F5FF'
  const baseFont = taxSheetFont()

  sheet.mergeCells('A1:E2')
  sheet.getCell('A1').value = '전자세금계산서'
  sheet.getCell('A1').font = { ...baseFont, size: 18, bold: true }
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.mergeCells('F1:G1'); sheet.getCell('F1').value = '승인번호'
  sheet.mergeCells('H1:J1'); sheet.getCell('H1').value = '홈택스 발급 후 입력'
  sheet.mergeCells('F2:G2'); sheet.getCell('F2').value = '작성 구분'
  sheet.mergeCells('H2:J2'); sheet.getCell('H2').value = Number(item.taxAmount) > 0 ? '일반 과세' : '면세'

  sheet.mergeCells('A3:A7'); sheet.getCell('A3').value = '공\n급\n자'
  sheet.mergeCells('F3:F7'); sheet.getCell('F3').value = '공\n급\n받\n는\n자'
  sheet.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: supplierSectionFill } }
  sheet.getCell('F3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: buyerSectionFill } }
  sheet.getCell('A3').font = { ...baseFont, bold: true, color: { argb: 'FFCA3333' } }
  sheet.getCell('F3').font = { ...baseFont, bold: true, color: { argb: 'FF2468A6' } }
  sheet.getCell('A3').alignment = sheet.getCell('F3').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }

  const setTaxCell = (address: string, value: string, fill: string, bold = false) => {
    const cell = sheet.getCell(address)
    cell.value = value
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    cell.font = { ...baseFont, bold }
    cell.alignment = { horizontal: bold ? 'center' : 'left', vertical: 'middle', wrapText: true }
  }
  ;[3, 4, 5, 6, 7].forEach((row) => {
    ;['B', 'D'].forEach((col) => setTaxCell(`${col}${row}`, '', supplierLabelFill, true))
    ;['C', 'E'].forEach((col) => setTaxCell(`${col}${row}`, '', supplierFill))
    ;['G', 'I'].forEach((col) => setTaxCell(`${col}${row}`, '', buyerLabelFill, true))
    ;['H', 'J'].forEach((col) => setTaxCell(`${col}${row}`, '', buyerFill))
  })
  setTaxCell('B3', '등록번호', supplierLabelFill, true); setTaxCell('C3', supplier.bizNumber, supplierFill)
  setTaxCell('D3', '종사업자\n번호', supplierLabelFill, true); setTaxCell('E3', '', supplierFill)
  setTaxCell('B4', '상호\n(법인명)', supplierLabelFill, true); setTaxCell('C4', supplier.name, supplierFill)
  setTaxCell('D4', '대표자', supplierLabelFill, true); setTaxCell('E4', supplier.representative, supplierFill)
  setTaxCell('B5', '사업장 주소', supplierLabelFill, true); sheet.mergeCells('C5:E5'); setTaxCell('C5', supplier.address, supplierFill)
  setTaxCell('B6', '업태', supplierLabelFill, true); setTaxCell('C6', supplier.bizType, supplierFill)
  setTaxCell('D6', '종목', supplierLabelFill, true); setTaxCell('E6', supplier.bizItem, supplierFill)
  setTaxCell('B7', '이메일', supplierLabelFill, true); sheet.mergeCells('C7:E7'); setTaxCell('C7', supplier.email, supplierFill)

  setTaxCell('G3', '등록번호', buyerLabelFill, true); setTaxCell('H3', buyer.bizNumber, buyerFill)
  setTaxCell('I3', '종사업자\n번호', buyerLabelFill, true); setTaxCell('J3', '', buyerFill)
  setTaxCell('G4', '상호\n(법인명)', buyerLabelFill, true); setTaxCell('H4', buyer.name, buyerFill)
  setTaxCell('I4', '대표자', buyerLabelFill, true); setTaxCell('J4', buyer.representative, buyerFill)
  setTaxCell('G5', '사업장 주소', buyerLabelFill, true); sheet.mergeCells('H5:J5'); setTaxCell('H5', buyer.address, buyerFill)
  setTaxCell('G6', '업태', buyerLabelFill, true); setTaxCell('H6', buyer.bizType, buyerFill)
  setTaxCell('I6', '종목', buyerLabelFill, true); setTaxCell('J6', buyer.bizItem, buyerFill)
  setTaxCell('G7', '이메일', buyerLabelFill, true); sheet.mergeCells('H7:J7'); setTaxCell('H7', buyer.email, buyerFill)

  sheet.mergeCells('A8:B8'); sheet.getCell('A8').value = '작성일자'
  sheet.mergeCells('C8:D8'); sheet.getCell('C8').value = '공급가액'
  sheet.mergeCells('E8:F8'); sheet.getCell('E8').value = '세액'
  sheet.mergeCells('G8:J8'); sheet.getCell('G8').value = '수정사유'
  sheet.mergeCells('A9:B9'); sheet.getCell('A9').value = issueDate
  sheet.mergeCells('C9:D9'); sheet.getCell('C9').value = Number(item.supplyAmount)
  sheet.mergeCells('E9:F9'); sheet.getCell('E9').value = Number(item.taxAmount)
  sheet.mergeCells('G9:J9'); sheet.getCell('G9').value = ''
  sheet.mergeCells('A10:B10'); sheet.getCell('A10').value = '비고'
  const invoiceCar = item.carNumber
    ? (settings.cars || []).find((car) => car.number === item.carNumber)
    : (settings.cars || []).find((car) => car.type === 'main')
  const accountMemo = `${profile?.bankName || '-'} ${profile?.accountNumber || '-'} / ${profile?.name || '-'} / ${invoiceCar?.number || '-'}`
  sheet.mergeCells('C10:J10'); sheet.getCell('C10').value = accountMemo

  ;['A11', 'B11', 'C11', 'D11', 'E11', 'F11', 'H11', 'I11', 'J11'].forEach((address, index) => {
    sheet.getCell(address).value = ['월', '일', '품목', '규격', '수량', '단가', '공급가액', '세액', '비고'][index]
  })
  sheet.mergeCells('F11:G11')
  const [, month, day] = issueDate.split('-')
  sheet.getRow(12).values = [month, day, item.itemName || '화물운송료', '', 1, Number(item.supplyAmount), '', Number(item.supplyAmount), Number(item.taxAmount), item.remark || '']
  sheet.mergeCells('F12:G12')
  for (let row = 13; row <= 16; row += 1) {
    sheet.getRow(row).values = ['', '', '', '', '', '', '', '', '', '']
    sheet.mergeCells(`F${row}:G${row}`)
  }

  sheet.mergeCells('A17:B17'); sheet.getCell('A17').value = '합계금액'
  sheet.getCell('C17').value = '현금'; sheet.getCell('D17').value = '수표'; sheet.getCell('E17').value = '어음'
  sheet.mergeCells('F17:G17'); sheet.getCell('F17').value = '외상미수금'
  sheet.mergeCells('H17:J17'); sheet.getCell('H17').value = '청구 구분'
  sheet.mergeCells('A18:B18'); sheet.getCell('A18').value = Number(item.totalAmount)
  sheet.getCell('C18').value = ''; sheet.getCell('D18').value = ''; sheet.getCell('E18').value = ''
  sheet.mergeCells('F18:G18'); sheet.getCell('F18').value = Number(item.totalAmount)
  sheet.mergeCells('H18:J18'); sheet.getCell('H18').value = '이 금액을 청구함'
  sheet.mergeCells('A19:J19'); sheet.getCell('A19').value = '※ 본 문서는 세금계산서 작성 및 확인을 위한 자료입니다. 실제 발급 여부는 홈택스에서 확인해 주세요.'
  return sheet
}
