import {
  appendMarkupInsideElement,
  findElement,
  getSelfClosingTagMarkup,
  prependMarkupInsideElement,
  sanitizeTextContent,
} from 'write-excel-file/utility'
import type { Feature } from 'write-excel-file/universal'

export const TAX_PRINT_SHEET = '세금계산서'
export const TAX_PRINT_AREA = '$A$1:$J$19'
export const TAX_PAGE_MARGINS = { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.1, footer: 0.1 }

export type TaxDocumentInfo = { creator: string, subject: string, created: Date }

const CORE_PATH = 'docProps/core.xml'
const CORE_TYPE = 'application/vnd.openxmlformats-package.core-properties+xml'
const CORE_RELATION = 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties'

function appendInside(xml: string, tagName: string, markup: string) {
  const element = findElement(xml, tagName)
  if (!element) throw new Error(`엑셀 파일 속 <${tagName}>가 없습니다`)
  return appendMarkupInsideElement(xml, element, markup)
}

function coreXml({ creator, subject, created }: TaxDocumentInfo) {
  const time = `${created.toISOString().slice(0, 19)}Z`
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    + `<dc:creator>${sanitizeTextContent(creator)}</dc:creator>`
    + `<dc:subject>${sanitizeTextContent(subject)}</dc:subject>`
    + `<dcterms:created xsi:type="dcterms:W3CDTF">${time}</dcterms:created>`
    + `<dcterms:modified xsi:type="dcterms:W3CDTF">${time}</dcterms:modified>`
    + '</cp:coreProperties>'
}

export function taxInvoicePrintFeature(info: TaxDocumentInfo): Feature<Blob> {
  return {
    files: {
      transform: {
        'xl/worksheets/sheet{id}.xml': {
          transform: (xml, sheetOptions) => {
            if (sheetOptions.sheet !== TAX_PRINT_SHEET) return xml
            const worksheet = findElement(xml, 'worksheet')
            if (!worksheet) throw new Error('엑셀 파일 속 <worksheet>가 없습니다')
            return prependMarkupInsideElement(xml, worksheet, `<sheetPr>${getSelfClosingTagMarkup('pageSetUpPr', { fitToPage: 1 })}</sheetPr>`)
          },
          transformElementAttributes: (tagName, attributes, _index, sheetOptions) => {
            if (sheetOptions.sheet !== TAX_PRINT_SHEET) return attributes
            if (tagName === 'pageMargins') return { ...attributes, ...TAX_PAGE_MARGINS }
            if (tagName === 'pageSetup') return { ...attributes, fitToWidth: 1, fitToHeight: 1 }
            return attributes
          },
        },
        'xl/workbook.xml': {
          transform: (xml, sheetsOptions) => {
            const sheetIndex = sheetsOptions.findIndex((options) => options.sheet === TAX_PRINT_SHEET)
            if (sheetIndex < 0) return xml
            const area = sanitizeTextContent(`'${TAX_PRINT_SHEET}'!${TAX_PRINT_AREA}`)
            return appendInside(xml, 'definedNames', `<definedName name="_xlnm.Print_Area" localSheetId="${sheetIndex}">${area}</definedName>`)
          },
        },
        '[Content_Types].xml': {
          transform: (xml) => appendInside(xml, 'Types', getSelfClosingTagMarkup('Override', { PartName: `/${CORE_PATH}`, ContentType: CORE_TYPE })),
        },
        '_rels/.rels': {
          transform: (xml) => appendInside(xml, 'Relationships', getSelfClosingTagMarkup('Relationship', { Id: 'rId-drivelog-core', Type: CORE_RELATION, Target: CORE_PATH })),
        },
      },
      write: {
        files: () => ({ [CORE_PATH]: coreXml(info) }),
      },
    },
  }
}
