import type { CellObject, SheetData } from 'write-excel-file/universal'

type Side = 'left' | 'right' | 'top' | 'bottom'
type Line = { style: 'thin' | 'medium', color: string }
type FontOptions = { size?: number, bold?: boolean, color?: string }
type AlignOptions = { align?: 'left' | 'center' | 'right', wrap?: boolean }

export type TaxGrid = { cells: CellObject[][], merges: Array<[number, number, number, number]>, heights: Record<number, number> }

const ROWS = 19
const COLS = 10
const SIDES: Side[] = ['left', 'right', 'top', 'bottom']

export function createTaxGrid(): TaxGrid {
  return { cells: Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({}))), merges: [], heights: {} }
}

function position(address: string): [number, number] {
  const match = /^([A-J])(\d+)$/.exec(address)
  if (!match) throw new Error(`잘못된 칸 주소: ${address}`)
  return [Number(match[2]) - 1, match[1].charCodeAt(0) - 65]
}

export function cellAt(grid: TaxGrid, address: string) {
  const [row, col] = position(address)
  return grid.cells[row][col]
}

export function mergeRange(grid: TaxGrid, range: string) {
  const [from, to] = range.split(':')
  grid.merges.push([...position(from), ...position(to)])
}

export function setFont(cell: CellObject, { size = 10, bold = false, color = '#222222' }: FontOptions = {}) {
  cell.fontFamily = '맑은 고딕'
  cell.fontSize = size
  cell.fontWeight = bold ? 'bold' : undefined
  cell.textColor = color
}

export function setAlign(cell: CellObject, { align, wrap }: AlignOptions) {
  cell.align = align
  cell.alignVertical = 'center'
  cell.wrap = wrap
}

function setSide(cell: CellObject, side: Side, line: Line) {
  cell[`${side}BorderStyle`] = line.style
  cell[`${side}BorderColor`] = line.color
}

function setAllSides(cell: CellObject, line: Line) {
  SIDES.forEach((side) => setSide(cell, side, line))
}

export function styleTaxGrid(grid: TaxGrid) {
  const at = (row: number, col: number) => grid.cells[row - 1][col - 1]
  const thinBlue: Line = { style: 'thin', color: '#8EA9D6' }
  const mediumBlue: Line = { style: 'medium', color: '#365B9D' }
  const headerFill = '#F1F3F7'

  grid.cells.flat().forEach((cell) => {
    setAllSides(cell, thinBlue)
    if (!cell.fontFamily) setFont(cell)
    cell.alignVertical = 'center'
    cell.wrap = true
  })
  for (let col = 1; col <= COLS; col += 1) {
    setSide(at(1, col), 'top', mediumBlue)
    setSide(at(ROWS, col), 'bottom', mediumBlue)
  }
  for (let row = 1; row <= ROWS; row += 1) setSide(at(row, 1), 'left', mediumBlue)

  const supplierBorder: Line = { style: 'thin', color: '#FFD9D9' }
  const buyerBorder: Line = { style: 'thin', color: '#C2D9F2' }
  const supplierOuter: Line = { style: 'medium', color: '#FFD9D9' }
  const buyerOuter: Line = { style: 'medium', color: '#C2D9F2' }
  for (let row = 3; row <= 7; row += 1) {
    for (let col = 1; col <= 5; col += 1) setAllSides(at(row, col), supplierBorder)
    for (let col = 6; col <= 10; col += 1) setAllSides(at(row, col), buyerBorder)
    setSide(at(row, 1), 'left', supplierOuter)
    setSide(at(row, 5), 'right', supplierOuter)
    setSide(at(row, 6), 'left', buyerOuter)
  }
  for (let col = 1; col <= COLS; col += 1) {
    const outer = col <= 5 ? supplierOuter : buyerOuter
    setSide(at(3, col), 'top', outer)
    setSide(at(7, col), 'bottom', outer)
  }
  for (let row = 1; row <= ROWS; row += 1) setSide(at(row, COLS), 'right', mediumBlue)

  ;['B3', 'D3', 'B4', 'D4', 'B5', 'B6', 'D6', 'B7'].forEach((address) => setFont(cellAt(grid, address), { bold: true, color: '#AF5F5F' }))
  ;['G3', 'I3', 'G4', 'I4', 'G5', 'G6', 'I6', 'G7'].forEach((address) => setFont(cellAt(grid, address), { bold: true, color: '#3A77A2' }))
  ;[8, 11, 17].forEach((row) => {
    for (let col = 1; col <= COLS; col += 1) {
      const cell = at(row, col)
      cell.backgroundColor = headerFill
      setFont(cell, { bold: true })
      setAlign(cell, { align: 'center' })
    }
  })
  ;[1, 2].forEach((row) => {
    for (let col = 1; col <= COLS; col += 1) at(row, col).backgroundColor = headerFill
  })
  ;['F1', 'F2', 'A8', 'C8', 'E8', 'G8', 'A10', 'A11', 'B11', 'C11', 'D11', 'E11', 'F11', 'H11', 'I11', 'J11', 'A17', 'C17', 'D17', 'E17', 'F17', 'H17'].forEach((address) => {
    const cell = cellAt(grid, address)
    setAlign(cell, { align: 'center', wrap: true })
    setFont(cell, { bold: true })
  })
  ;['C9', 'E9', 'F12', 'H12', 'I12', 'A18', 'F18'].forEach((address) => {
    const cell = cellAt(grid, address)
    if (typeof cell.value === 'number') cell.format = '#,##0'
    setAlign(cell, { align: 'right' })
  })
  setFont(cellAt(grid, 'H18'), { bold: true })
  setAlign(cellAt(grid, 'H18'), { align: 'center' })
  setFont(cellAt(grid, 'A19'), { size: 8, color: '#777777' })
  setAlign(cellAt(grid, 'A19'), { align: 'center' })
  grid.heights = { 1: 25, 2: 25, 3: 32, 4: 32, 5: 34, 19: 24 }
}

export function toSheetData(grid: TaxGrid): SheetData {
  const rows: Array<Array<CellObject | null>> = grid.cells.map((row) => row.map((cell) => ({ ...cell })))
  for (const [top, left, bottom, right] of grid.merges) {
    const master = rows[top][left]
    if (!master) throw new Error('합친 칸이 겹칩니다')
    const topRight = grid.cells[top][right]
    const bottomLeft = grid.cells[bottom][left]
    master.rightBorderStyle = topRight.rightBorderStyle
    master.rightBorderColor = topRight.rightBorderColor
    master.bottomBorderStyle = bottomLeft.bottomBorderStyle
    master.bottomBorderColor = bottomLeft.bottomBorderColor
    if (right > left) master.columnSpan = right - left + 1
    if (bottom > top) master.rowSpan = bottom - top + 1
    for (let row = top; row <= bottom; row += 1) {
      for (let col = left; col <= right; col += 1) {
        if (row !== top || col !== left) rows[row][col] = null
      }
    }
  }
  rows.forEach((row, index) => {
    const first = row.find((cell) => cell !== null)
    if (first) first.height = grid.heights[index + 1] ?? 21
  })
  return rows
}
