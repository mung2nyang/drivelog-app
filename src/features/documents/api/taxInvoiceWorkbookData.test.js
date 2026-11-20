// @ts-check
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import ExcelJS from 'exceljs'
import { buildTaxInvoiceWorkbook } from './taxInvoiceExcelBuilder.ts'
import { buildTaxInvoiceExcelBlob, buildTaxInvoiceSheets } from './taxInvoiceWorkbookData.ts'

/** @type {import('../../../domain/financeTypes.ts').FinanceSettings} */
const settings = {
  bizName: '차주회사', bizNumber: '123-45-67890', bizRepresentative: '홍길동', bizAddress: '서울시',
  bizType: '운송', bizItem: '화물', bizEmail: 'owner@example.com',
  cars: [{ id: 'car-1', type: 'main', number: '12가3456' }],
}

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
  id: 'sales|2026-06|c2',
  flow: 'sales',
  clientName: '면세거래처',
  supplyAmount: 50000,
  taxAmount: 0,
  totalAmount: 50000,
  carNumber: '99가9999',
  supplierBiz: { name: '차량사업자', bizNumber: '999-88-77777', representative: '이대표', address: '', bizType: '', bizItem: '', email: '' },
}

const CASES = [
  { label: '매출 계산서', item: salesItem, profile: { bankName: '국민', accountNumber: '123-456', name: '홍길동' }, monthKey: '2026-05' },
  { label: '면세·차량 사업자·빈 값', item: exemptItem, profile: {}, monthKey: '2026-06' },
]

/** @typedef {import('write-excel-file/universal').CellObject} CellObject */

/** @param {import('write-excel-file/universal').Cell} raw @returns {CellObject | null} */
function cellObjectOf(raw) {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'object' && Object.getPrototypeOf(raw) === Object.prototype) return /** @type {CellObject} */ (raw)
  return { value: raw }
}

/** @param {{ argb?: string } | undefined} color */
const hex = (color) => (color?.argb ? `#${color.argb.slice(2)}` : undefined)
/** @param {import('write-excel-file/universal').Value | import('exceljs').CellValue | undefined} value */
const plain = (value) => (value === undefined || value === null ? '' : value)
const SIDES = /** @type {const} */ (['left', 'right', 'top', 'bottom'])

/** @param {import('exceljs').Cell} cell */
function oldLook(cell) {
  const font = cell.font || {}
  const fill = /** @type {{ fgColor?: { argb?: string } }} */ (cell.fill || {})
  const align = cell.alignment || {}
  return {
    fontFamily: font.name, fontSize: font.size, bold: Boolean(font.bold), textColor: hex(font.color),
    backgroundColor: hex(fill.fgColor),
    align: align.horizontal, alignVertical: align.vertical === 'middle' ? 'center' : align.vertical, wrap: Boolean(align.wrapText),
    format: cell.numFmt,
  }
}

/** @param {CellObject} cell */
function newLook(cell) {
  return {
    fontFamily: cell.fontFamily, fontSize: cell.fontSize, bold: cell.fontWeight === 'bold', textColor: cell.textColor,
    backgroundColor: cell.backgroundColor,
    align: cell.align, alignVertical: cell.alignVertical, wrap: Boolean(cell.wrap),
    format: cell.format,
  }
}

/** @param {import('exceljs').Cell} cell @param {typeof SIDES[number]} side */
function oldSide(cell, side) {
  const line = cell.border?.[side]
  return line ? `${line.style} ${hex(line.color)}` : 'none'
}

/** @param {CellObject} cell @param {typeof SIDES[number]} side */
function newSide(cell, side) {
  return cell[`${side}BorderStyle`] ? `${cell[`${side}BorderStyle`]} ${cell[`${side}BorderColor`]}` : 'none'
}

/** @param {Array<Array<CellObject | null>>} data */
function mergesOf(data) {
  /** @type {number[][]} */
  const ranges = []
  data.forEach((row, r) => row.forEach((cell, c) => {
    if (cell && ((cell.columnSpan || 1) > 1 || (cell.rowSpan || 1) > 1)) ranges.push([r + 1, c + 1, r + (cell.rowSpan || 1), c + (cell.columnSpan || 1)])
  }))
  return ranges
}

/** @param {string} range */
function rangeOf(range) {
  const [from, to] = range.split(':').map((address) => [Number(address.slice(1)), address.charCodeAt(0) - 64])
  return [from[0], from[1], to[0], to[1]]
}

function bothBooks(/** @type {typeof CASES[number]} */ { item, profile, monthKey }) {
  const oldBook = buildTaxInvoiceWorkbook(ExcelJS, item, settings, profile, monthKey)
  const sheets = buildTaxInvoiceSheets(item, settings, profile, monthKey)
  return { oldBook, sheets }
}

describe('새 엑셀 자료가 옛 exceljs 결과와 같다', () => {
  for (const testCase of CASES) {
    test(`세금계산서 장 — ${testCase.label}`, () => {
      const { oldBook, sheets } = bothBooks(testCase)
      const oldSheet = oldBook.getWorksheet('세금계산서')
      assert.ok(oldSheet)
      const sheet = sheets[0]
      assert.equal(sheet.sheet, '세금계산서')
      const data = sheet.data.map((row) => row.map(cellObjectOf))

      const oldMerges = oldSheet.model.merges.map(rangeOf).sort()
      const newMerges = mergesOf(data).sort()
      assert.equal(oldMerges.length, 34)
      assert.deepEqual(newMerges, oldMerges)

      /** @param {number} r @param {number} c */
      const ownerOf = (r, c) => newMerges.find(([r1, c1, r2, c2]) => r >= r1 && r <= r2 && c >= c1 && c <= c2)
      for (let r = 1; r <= 19; r += 1) {
        for (let c = 1; c <= 10; c += 1) {
          const where = `${String.fromCharCode(64 + c)}${r}`
          const oldCell = oldSheet.getCell(r, c)
          const range = ownerOf(r, c)
          const isMaster = !range || (range[0] === r && range[1] === c)
          const shown = range ? data[range[0] - 1][range[1] - 1] : data[r - 1][c - 1]
          assert.ok(shown, `${where} 칸 있음`)
          if (isMaster) {
            assert.deepEqual(plain(shown.value), plain(oldCell.value), `${where} 값`)
            assert.deepEqual(newLook(shown), oldLook(oldCell), `${where} 꾸밈`)
          } else {
            assert.equal(data[r - 1][c - 1], null, `${where} 합친 칸 안쪽은 비움`)
          }
          for (const side of SIDES) {
            const onEdge = !range
              || (side === 'left' && c === range[1]) || (side === 'right' && c === range[3])
              || (side === 'top' && r === range[0]) || (side === 'bottom' && r === range[2])
            if (onEdge) assert.equal(newSide(shown, side), oldSide(oldCell, side), `${where} ${side} 테두리`)
          }
        }
        const height = Math.max(0, ...data[r - 1].map((cell) => cell?.height || 0))
        assert.equal(height, oldSheet.getRow(r).height || oldSheet.properties.defaultRowHeight, `${r}행 높이`)
      }
      assert.deepEqual(sheet.columns?.map((column) => column.width), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => oldSheet.getColumn(c).width))
      assert.equal(sheet.showGridLines, false)
      assert.equal(oldSheet.views[0].showGridLines, false)
      assert.equal(sheet.orientation, oldSheet.pageSetup.orientation)
    })

    test(`입력자료 장 — ${testCase.label}`, () => {
      const { oldBook, sheets } = bothBooks(testCase)
      const oldSheet = oldBook.getWorksheet('입력자료')
      assert.ok(oldSheet)
      const sheet = sheets[1]
      assert.equal(sheet.sheet, '입력자료')
      const data = sheet.data.map((row) => row.map(cellObjectOf))
      assert.equal(data.length, 2)
      for (let r = 1; r <= 2; r += 1) {
        assert.equal(data[r - 1].length, 21)
        for (let c = 1; c <= 21; c += 1) {
          const oldCell = oldSheet.getCell(r, c)
          const cell = data[r - 1][c - 1] || { value: undefined }
          assert.deepEqual(plain(cell.value), plain(oldCell.value), `${r}행 ${c}열 값`)
          assert.deepEqual(newLook(cell), oldLook(oldCell), `${r}행 ${c}열 꾸밈`)
        }
      }
      assert.deepEqual(sheet.columns?.map((column) => column.width), oldSheet.columns.map((column) => column.width))
      assert.equal(sheet.stickyRowsCount, 1)
      const oldView = /** @type {{ state?: string, ySplit?: number }} */ (oldSheet.views[0])
      assert.deepEqual([oldView.state, oldView.ySplit], ['frozen', sheet.stickyRowsCount])
    })
  }

  test('새 부품으로 실제 엑셀 파일을 만든다', async () => {
    for (const { item, profile, monthKey } of CASES) {
      const blob = await buildTaxInvoiceExcelBlob(item, settings, profile, monthKey)
      assert.ok(blob.size > 0)
      const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer())
      assert.deepEqual([...head], [0x50, 0x4b])
    }
  })
})
