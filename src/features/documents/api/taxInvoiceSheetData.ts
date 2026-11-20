import { cellAt, createTaxGrid, mergeRange, setAlign, setFont, styleTaxGrid, toSheetData } from './taxInvoiceSheetDataStyle.ts'
import type { InvoiceLike } from '../../../domain/financeTaxInvoiceEntries.ts'
import type { FinanceSettings } from '../../../domain/financeTypes.ts'

export type TaxSheetParty = { bizNumber: string, name: string, representative: string, address: string, bizType: string, bizItem: string, email: string }

export type TaxSheetContent = {
  item: InvoiceLike
  settings: FinanceSettings
  profile: { bankName?: string, accountNumber?: string, name?: string }
  supplier: TaxSheetParty
  buyer: TaxSheetParty
  issueDate: string
}

type CellValue = string | number

export function buildTaxInvoiceSheetData({ item, settings, profile, supplier, buyer, issueDate }: TaxSheetContent) {
  const grid = createTaxGrid()
  const put = (address: string, value: CellValue) => { cellAt(grid, address).value = value }
  const merge = (range: string, value?: CellValue) => {
    mergeRange(grid, range)
    if (value !== undefined) put(range.split(':')[0], value)
  }
  const supplierFill = '#FFFFFF'
  const supplierSectionFill = '#FFD9D9'
  const supplierLabelFill = '#FFF2F2'
  const buyerFill = '#FFFFFF'
  const buyerSectionFill = '#C2D9F2'
  const buyerLabelFill = '#F2F5FF'

  merge('A1:E2', '전자세금계산서')
  setFont(cellAt(grid, 'A1'), { size: 18, bold: true })
  setAlign(cellAt(grid, 'A1'), { align: 'center' })
  merge('F1:G1', '승인번호')
  merge('H1:J1', '홈택스 발급 후 입력')
  merge('F2:G2', '작성 구분')
  merge('H2:J2', Number(item.taxAmount) > 0 ? '일반 과세' : '면세')

  merge('A3:A7', '공\n급\n자')
  merge('F3:F7', '공\n급\n받\n는\n자')
  cellAt(grid, 'A3').backgroundColor = supplierSectionFill
  cellAt(grid, 'F3').backgroundColor = buyerSectionFill
  setFont(cellAt(grid, 'A3'), { bold: true, color: '#CA3333' })
  setFont(cellAt(grid, 'F3'), { bold: true, color: '#2468A6' })
  setAlign(cellAt(grid, 'A3'), { align: 'center', wrap: true })
  setAlign(cellAt(grid, 'F3'), { align: 'center', wrap: true })

  const setTaxCell = (address: string, value: string, fill: string, bold = false) => {
    const cell = cellAt(grid, address)
    cell.value = value
    cell.backgroundColor = fill
    setFont(cell, { bold })
    setAlign(cell, { align: bold ? 'center' : 'left', wrap: true })
  }
  ;[3, 4, 5, 6, 7].forEach((row) => {
    ;['B', 'D'].forEach((col) => setTaxCell(`${col}${row}`, '', supplierLabelFill, true))
    ;['C', 'E'].forEach((col) => setTaxCell(`${col}${row}`, '', supplierFill))
    ;['G', 'I'].forEach((col) => setTaxCell(`${col}${row}`, '', buyerLabelFill, true))
    ;['H', 'J'].forEach((col) => setTaxCell(`${col}${row}`, '', buyerFill))
  })
  const parties: Array<[TaxSheetParty, string[], string, string]> = [
    [supplier, ['B', 'C', 'D', 'E'], supplierLabelFill, supplierFill],
    [buyer, ['G', 'H', 'I', 'J'], buyerLabelFill, buyerFill],
  ]
  parties.forEach(([party, [label, value, label2, value2], labelFill, valueFill]) => {
    setTaxCell(`${label}3`, '등록번호', labelFill, true); setTaxCell(`${value}3`, party.bizNumber, valueFill)
    setTaxCell(`${label2}3`, '종사업자\n번호', labelFill, true); setTaxCell(`${value2}3`, '', valueFill)
    setTaxCell(`${label}4`, '상호\n(법인명)', labelFill, true); setTaxCell(`${value}4`, party.name, valueFill)
    setTaxCell(`${label2}4`, '대표자', labelFill, true); setTaxCell(`${value2}4`, party.representative, valueFill)
    setTaxCell(`${label}5`, '사업장 주소', labelFill, true); mergeRange(grid, `${value}5:${value2}5`); setTaxCell(`${value}5`, party.address, valueFill)
    setTaxCell(`${label}6`, '업태', labelFill, true); setTaxCell(`${value}6`, party.bizType, valueFill)
    setTaxCell(`${label2}6`, '종목', labelFill, true); setTaxCell(`${value2}6`, party.bizItem, valueFill)
    setTaxCell(`${label}7`, '이메일', labelFill, true); mergeRange(grid, `${value}7:${value2}7`); setTaxCell(`${value}7`, party.email, valueFill)
  })

  merge('A8:B8', '작성일자')
  merge('C8:D8', '공급가액')
  merge('E8:F8', '세액')
  merge('G8:J8', '수정사유')
  merge('A9:B9', issueDate)
  merge('C9:D9', Number(item.supplyAmount))
  merge('E9:F9', Number(item.taxAmount))
  merge('G9:J9', '')
  merge('A10:B10', '비고')
  const invoiceCar = item.carNumber
    ? (settings.cars || []).find((car) => car.number === item.carNumber)
    : (settings.cars || []).find((car) => car.type === 'main')
  merge('C10:J10', `${profile?.bankName || '-'} ${profile?.accountNumber || '-'} / ${profile?.name || '-'} / ${invoiceCar?.number || '-'}`)

  ;['A11', 'B11', 'C11', 'D11', 'E11', 'F11', 'H11', 'I11', 'J11'].forEach((address, index) => {
    put(address, ['월', '일', '품목', '규격', '수량', '단가', '공급가액', '세액', '비고'][index])
  })
  merge('F11:G11')
  const [, month, day] = issueDate.split('-')
  const itemRow: CellValue[] = [month, day, item.itemName || '화물운송료', '', 1, Number(item.supplyAmount), '', Number(item.supplyAmount), Number(item.taxAmount), item.remark || '']
  itemRow.forEach((value, index) => { grid.cells[11][index].value = value })
  merge('F12:G12')
  for (let row = 13; row <= 16; row += 1) {
    grid.cells[row - 1].forEach((cell) => { cell.value = '' })
    merge(`F${row}:G${row}`)
  }

  merge('A17:B17', '합계금액')
  put('C17', '현금'); put('D17', '수표'); put('E17', '어음')
  merge('F17:G17', '외상미수금')
  merge('H17:J17', '청구 구분')
  merge('A18:B18', Number(item.totalAmount))
  put('C18', ''); put('D18', ''); put('E18', '')
  merge('F18:G18', Number(item.totalAmount))
  merge('H18:J18', '이 금액을 청구함')
  merge('A19:J19', '※ 본 문서는 세금계산서 작성 및 확인을 위한 자료입니다. 실제 발급 여부는 홈택스에서 확인해 주세요.')

  styleTaxGrid(grid)
  return toSheetData(grid)
}
