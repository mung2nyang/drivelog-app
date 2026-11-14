import type { Border, Borders, Worksheet } from 'exceljs'

export function taxSheetFont() {
  return { name: '맑은 고딕', size: 10, color: { argb: 'FF222222' } }
}

export function styleTaxInvoiceSheet(sheet: Worksheet) {
  const thinBlue: Border = { style: 'thin', color: { argb: 'FF8EA9D6' } }
  const mediumBlue: Border = { style: 'medium', color: { argb: 'FF365B9D' } }
  const allThin: Partial<Borders> = { top: thinBlue, left: thinBlue, bottom: thinBlue, right: thinBlue }
  const headerFill = 'FFF1F3F7'
  const baseFont = taxSheetFont()

  for (let row = 1; row <= 19; row += 1) {
    for (let col = 1; col <= 10; col += 1) {
      const cell = sheet.getCell(row, col)
      cell.border = allThin
      if (!cell.font || !cell.font.name) cell.font = baseFont
      cell.alignment = { ...(cell.alignment || {}), vertical: 'middle', wrapText: true }
    }
  }
  for (let col = 1; col <= 10; col += 1) {
    sheet.getCell(1, col).border = { ...sheet.getCell(1, col).border, top: mediumBlue }
    sheet.getCell(19, col).border = { ...sheet.getCell(19, col).border, bottom: mediumBlue }
  }
  for (let row = 1; row <= 19; row += 1) {
    sheet.getCell(row, 1).border = { ...sheet.getCell(row, 1).border, left: mediumBlue }
    sheet.getCell(row, 10).border = { ...sheet.getCell(row, 10).border, right: mediumBlue }
  }
  const supplierBorder: Border = { style: 'thin', color: { argb: 'FFFFD9D9' } }
  const buyerBorder: Border = { style: 'thin', color: { argb: 'FFC2D9F2' } }
  const supplierOuterBorder: Border = { style: 'medium', color: { argb: 'FFFFD9D9' } }
  const buyerOuterBorder: Border = { style: 'medium', color: { argb: 'FFC2D9F2' } }
  for (let row = 3; row <= 7; row += 1) {
    for (let col = 1; col <= 5; col += 1) sheet.getCell(row, col).border = { top: supplierBorder, left: supplierBorder, bottom: supplierBorder, right: supplierBorder }
    for (let col = 6; col <= 10; col += 1) sheet.getCell(row, col).border = { top: buyerBorder, left: buyerBorder, bottom: buyerBorder, right: buyerBorder }
    sheet.getCell(row, 1).border = { ...sheet.getCell(row, 1).border, left: supplierOuterBorder }
    sheet.getCell(row, 5).border = { ...sheet.getCell(row, 5).border, right: supplierOuterBorder }
    sheet.getCell(row, 6).border = { ...sheet.getCell(row, 6).border, left: buyerOuterBorder }
    sheet.getCell(row, 10).border = { ...sheet.getCell(row, 10).border, right: buyerOuterBorder }
  }
  for (let col = 1; col <= 5; col += 1) {
    sheet.getCell(3, col).border = { ...sheet.getCell(3, col).border, top: supplierOuterBorder }
    sheet.getCell(7, col).border = { ...sheet.getCell(7, col).border, bottom: supplierOuterBorder }
  }
  for (let col = 6; col <= 10; col += 1) {
    sheet.getCell(3, col).border = { ...sheet.getCell(3, col).border, top: buyerOuterBorder }
    sheet.getCell(7, col).border = { ...sheet.getCell(7, col).border, bottom: buyerOuterBorder }
  }
  for (let row = 1; row <= 19; row += 1) {
    sheet.getCell(row, 10).border = { ...sheet.getCell(row, 10).border, right: mediumBlue }
  }
  ;['B3', 'D3', 'B4', 'D4', 'B5', 'B6', 'D6', 'B7'].forEach((address) => {
    sheet.getCell(address).font = { ...baseFont, bold: true, color: { argb: 'FFAF5F5F' } }
  })
  ;['G3', 'I3', 'G4', 'I4', 'G5', 'G6', 'I6', 'G7'].forEach((address) => {
    sheet.getCell(address).font = { ...baseFont, bold: true, color: { argb: 'FF3A77A2' } }
  })
  ;[8, 11, 17].forEach((row) => {
    sheet.getRow(row).eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFill } }
      cell.font = { ...baseFont, bold: true }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })
  })
  ;[1, 2].forEach((row) => {
    for (let col = 1; col <= 10; col += 1) sheet.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFill } }
  })
  ;['F1', 'F2', 'A8', 'C8', 'E8', 'G8', 'A10', 'A11', 'B11', 'C11', 'D11', 'E11', 'F11', 'H11', 'I11', 'J11', 'A17', 'C17', 'D17', 'E17', 'F17', 'H17'].forEach((address) => {
    sheet.getCell(address).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    sheet.getCell(address).font = { ...baseFont, bold: true }
  })
  ;['C9', 'E9', 'F12', 'H12', 'I12', 'A18', 'F18'].forEach((address) => {
    sheet.getCell(address).numFmt = '#,##0'
    sheet.getCell(address).alignment = { horizontal: 'right', vertical: 'middle' }
  })
  sheet.getCell('H18').font = { ...baseFont, bold: true }
  sheet.getCell('H18').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell('A19').font = { ...baseFont, size: 8, color: { argb: 'FF777777' } }
  sheet.getCell('A19').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 25
  sheet.getRow(2).height = 25
  sheet.getRow(3).height = 32
  sheet.getRow(4).height = 32
  sheet.getRow(5).height = 34
  sheet.getRow(19).height = 24
}
