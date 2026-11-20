// @ts-check
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { strFromU8, unzipSync } from 'fflate'
import { buildTaxInvoiceExcelFileName } from './taxInvoiceExcel.ts'
import { buildTaxInvoiceExcelBlob, buildTaxInvoiceSheets } from './taxInvoiceWorkbookData.ts'

/** @type {import('../../../domain/financeTypes.ts').FinanceSettings} */
const settings = {
  bizName: '차주회사', bizNumber: '123-45-67890', bizRepresentative: '홍길동', bizAddress: '서울시',
  bizType: '운송', bizItem: '화물', bizEmail: 'owner@example.com',
  cars: [{ id: 'car-1', type: 'main', number: '12가3456' }],
}

const profile = { bankName: '국민', accountNumber: '123-456', name: '홍길동' }

/** @type {import('../../../domain/financeTaxInvoiceEntries.ts').InvoiceLike} */
const salesItem = {
  id: 'sales|2026-05|c1', flow: 'sales',
  clientName: '한진/물류', clientBizNumber: '111-22-33333', clientRepresentative: '김거래', clientAddress: '부산시',
  clientBizType: '물류', clientBizItem: '운송', clientEmail: 'client@example.com',
  supplyAmount: 100000, taxAmount: 10000, totalAmount: 110000,
  itemName: '화물운송료', remark: '비고1', issueDate: '2026-05-31', carNumber: '12가3456',
}

/** @type {import('../../../domain/financeTaxInvoiceEntries.ts').InvoiceLike} */
const exemptItem = {
  id: 'sales|2026-06|c2', flow: 'sales', clientName: '면세거래처',
  supplyAmount: 50000, taxAmount: 0, totalAmount: 50000, carNumber: '99가9999',
  supplierBiz: { name: '차량사업자', bizNumber: '999-88-77777', representative: '이대표', address: '', bizType: '', bizItem: '', email: '' },
}

/** @typedef {import('write-excel-file/universal').CellObject} CellObject */

/** @param {import('write-excel-file/universal').Cell} raw @returns {CellObject | null} */
function cellObjectOf(raw) {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'object' && Object.getPrototypeOf(raw) === Object.prototype) return /** @type {CellObject} */ (raw)
  return { value: raw }
}

/** @param {import('../../../domain/financeTaxInvoiceEntries.ts').InvoiceLike} item @param {number} index */
function sheetOf(item, index = 0) {
  const sheet = buildTaxInvoiceSheets(item, settings, profile, '2026-05')[index]
  const data = sheet.data.map((row) => row.map(cellObjectOf))
  /** @param {string} address */
  const at = (address) => data[Number(address.slice(1)) - 1][address.charCodeAt(0) - 65]
  return { sheet, data, at }
}

/** @param {import('../../../domain/financeTaxInvoiceEntries.ts').InvoiceLike} item */
async function filesOf(item) {
  const created = new Date('2026-05-31T09:10:11.123Z')
  const blob = await buildTaxInvoiceExcelBlob(item, settings, profile, '2026-05', created)
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  /** @param {string} path */
  return (path) => {
    assert.ok(files[path], `${path} 파일이 없습니다`)
    return strFromU8(files[path])
  }
}

describe('세금계산서 엑셀 자료', () => {
  test('공급가액·세액·합계금액이 숫자로 정확한 칸에 들어간다', () => {
    const { at } = sheetOf(salesItem)
    assert.deepEqual([at('C9')?.value, at('E9')?.value, at('A18')?.value, at('F18')?.value], [100000, 10000, 110000, 110000])
    assert.equal(at('C9')?.format, '#,##0')
    assert.equal(at('H2')?.value, '일반 과세')
    assert.equal(sheetOf(exemptItem).at('H2')?.value, '면세')
  })

  test('공급자 = 차주(차량 사업자가 있으면 그쪽), 공급받는자 = 거래처', () => {
    const { at } = sheetOf(salesItem)
    assert.deepEqual([at('C3')?.value, at('C4')?.value, at('H3')?.value, at('H4')?.value], ['123-45-67890', '차주회사', '111-22-33333', '한진/물류'])
    const exempt = sheetOf(exemptItem).at
    assert.deepEqual([exempt('C3')?.value, exempt('C4')?.value], ['999-88-77777', '차량사업자'])
    assert.equal(at('C10')?.value, '국민 123-456 / 홍길동 / 12가3456')
  })

  test('합친 칸 34개, 바깥 테두리, 줄 높이, 열 너비', () => {
    const { sheet, data, at } = sheetOf(salesItem)
    const merged = data.flat().filter((cell) => cell && ((cell.columnSpan || 1) > 1 || (cell.rowSpan || 1) > 1))
    assert.equal(merged.length, 34)
    assert.deepEqual([at('A1')?.columnSpan, at('A1')?.rowSpan, at('A19')?.columnSpan, at('A3')?.rowSpan], [5, 2, 10, 5])
    assert.equal(at('B1'), null)
    assert.deepEqual([at('A1')?.topBorderStyle, at('A1')?.topBorderColor, at('A1')?.leftBorderStyle], ['medium', '#365B9D', 'medium'])
    assert.deepEqual([at('A19')?.bottomBorderStyle, at('A19')?.rightBorderStyle, at('A19')?.rightBorderColor], ['medium', 'medium', '#365B9D'])
    assert.deepEqual([at('A3')?.topBorderColor, at('A3')?.bottomBorderColor, at('A3')?.backgroundColor], ['#FFD9D9', '#FFD9D9', '#FFD9D9'])
    const heights = data.map((row) => row.find((cell) => cell)?.height)
    assert.deepEqual(heights, [25, 25, 32, 32, 34, ...Array(13).fill(undefined), 24])
    assert.deepEqual(sheet.columns?.map((column) => column.width), [5, 10, 18, 10, 14, 5, 10, 18, 10, 14])
    assert.deepEqual([sheet.sheet, sheet.orientation, sheet.showGridLines], ['세금계산서', 'landscape', false])
  })

  test('입력자료 장 2행이 머리줄 순서로 실제 값을 담는다', () => {
    const { sheet, data } = sheetOf(salesItem, 1)
    assert.equal(sheet.sheet, '입력자료')
    assert.equal(sheet.stickyRowsCount, 1)
    assert.deepEqual([data[0][0]?.value, data[0][0]?.backgroundColor, data[0][0]?.fontWeight], ['작성일자', '#365B9D', 'bold'])
    const row = data[1].map((cell) => cell?.value)
    assert.deepEqual([row[0], row[1], row[2], row[8], row[9], row[15], row[17], row[18], row[19]], ['2026-05-31', '123-45-67890', '차주회사', '111-22-33333', '한진/물류', '화물운송료', 100000, 10000, 110000])
    assert.equal(data[1][17]?.format, '#,##0')
  })
})

describe('세금계산서 엑셀 파일 속 인쇄·문서 정보', () => {
  test('세금계산서 장만 한 장에 맞추고 여백·방향을 옛 파일과 같게', async () => {
    const read = await filesOf(salesItem)
    const sheet1 = read('xl/worksheets/sheet1.xml')
    assert.match(sheet1, /<worksheet[^>]*><sheetPr><pageSetUpPr fitToPage="1"\/><\/sheetPr>/)
    assert.match(sheet1, /<pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.1" footer="0.1"\/>/)
    assert.match(sheet1, /<pageSetup [^>]*orientation="landscape"[^>]*fitToWidth="1" fitToHeight="1"\/>/)
    assert.doesNotMatch(read('xl/worksheets/sheet2.xml'), /fitToPage|fitToWidth/)
  })

  test('인쇄 범위 A1:J19가 이름 목록 하나에 들어간다', async () => {
    const workbook = (await filesOf(salesItem))('xl/workbook.xml')
    assert.equal(workbook.match(/<definedNames/g)?.length, 1)
    assert.match(workbook, /<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'세금계산서'!\$A\$1:\$J\$19<\/definedName><\/definedNames>/)
  })

  test('문서 정보(작성자·주제·만든 날)와 기본 글꼴', async () => {
    const read = await filesOf(salesItem)
    const core = read('docProps/core.xml')
    assert.match(core, /<dc:creator>차주회사<\/dc:creator>/)
    assert.match(core, /<dc:subject>2026-05 화물운송료<\/dc:subject>/)
    assert.match(core, /<dcterms:created xsi:type="dcterms:W3CDTF">2026-05-31T09:10:11Z<\/dcterms:created>/)
    assert.match(read('[Content_Types].xml'), /PartName="\/docProps\/core.xml"/)
    assert.match(read('_rels/.rels'), /Target="docProps\/core.xml"/)
    assert.match(read('xl/styles.xml'), /<fonts count="\d+"><font><name val="맑은 고딕"\/><sz val="11"\/>/)
  })
})

describe('buildTaxInvoiceExcelFileName', () => {
  test('특수문자가 포함된 거래처명은 파일명에서 _ 로 치환된다', () => {
    const name = buildTaxInvoiceExcelFileName('2026-05', salesItem)
    assert.equal(name, '2026-05_한진_물류_매출 발행_계산서.xlsx')
    assert.equal(name.includes('/'), false)
  })
})
