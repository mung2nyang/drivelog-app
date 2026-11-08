// @ts-check
import { saveFileToDevice } from '../../../shared/utils/saveFile.ts'

/**
 * @param {HTMLElement} element
 * @param {'portrait'|'landscape'} [orientation] 넘기면 그 방향 A4 너비로 그림(법정 서식 = 가로)
 * @returns {Promise<HTMLCanvasElement>}
 */
async function renderReportCanvas(element, orientation) {
  const mod = await import('html2pdf.js')
  const html2pdf = mod.default
  const worker = html2pdf().set({
    ...(orientation ? { jsPDF: { unit: 'mm', format: 'a4', orientation } } : {}),
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    },
  }).from(element).toCanvas()
  return /** @type {HTMLCanvasElement} */ (await worker.get('canvas'))
}

/**
 * 이미지 여백(픽셀) — PDF에서 내용 폭은 A4 너비에서 좌우 10mm를 뺀 값(세로 190mm, 가로 277mm).
 * @param {number} width 그린 그림 너비(픽셀)
 * @param {'portrait'|'landscape'} [orientation]
 * @returns {{ x: number, y: number }}
 */
export function imageMarginPx(width, orientation) {
  const contentMm = orientation === 'landscape' ? 277 : 190
  return { x: Math.round((width * 10) / contentMm), y: Math.round((width * 12) / contentMm) }
}

// PDF 여백(위아래 12mm·좌우 10mm)과 같은 비율로 이미지 둘레에 흰 여백을 둔다.
/**
 * @param {HTMLCanvasElement} canvas
 * @param {'portrait'|'landscape'} [orientation]
 * @returns {HTMLCanvasElement}
 */
function addWhiteMargin(canvas, orientation) {
  const { x, y } = imageMarginPx(canvas.width, orientation)
  const padded = document.createElement('canvas')
  padded.width = canvas.width + x * 2
  padded.height = canvas.height + y * 2
  const ctx = padded.getContext('2d')
  if (!ctx) throw new Error('PNG 이미지 생성 실패')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, padded.width, padded.height)
  ctx.drawImage(canvas, x, y)
  return padded
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG 이미지 생성 실패'))), 'image/png')
  })
}

/**
 * @param {HTMLElement} element
 * @param {string} baseName 확장자 없는 파일명
 * @param {{ orientation?: 'portrait'|'landscape' }} [options]
 * @returns {Promise<File>}
 */
export async function createReportImageFile(element, baseName, { orientation } = {}) {
  const canvas = addWhiteMargin(await renderReportCanvas(element, orientation), orientation)
  const blob = await canvasToPngBlob(canvas)
  return new File([blob], `${baseName}.png`, { type: 'image/png' })
}

/**
 * @param {HTMLElement} element
 * @param {string} baseName
 * @param {{ orientation?: 'portrait'|'landscape' }} [options] 안 넘기면 세로(일상점검표 법정 서식은 가로)
 * @returns {Promise<File>}
 */
export async function createReportPdfFile(element, baseName, { orientation = 'portrait' } = {}) {
  const mod = await import('html2pdf.js')
  const html2pdf = mod.default
  /** @type {Parameters<InstanceType<(typeof html2pdf)['Worker']>['set']>[0]} */
  const opt = {
    margin: [12, 10, 12, 10],
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation },
  }
  const blob = /** @type {Blob} */ (await html2pdf().set(opt).from(element).outputPdf('blob'))
  return new File([blob], `${baseName}.pdf`, { type: 'application/pdf' })
}

/**
 * 화면의 운송비 내역서를 내보내기 모드로 그려 파일로 — 끝나면(실패해도) 모드를 뗀다.
 * @param {HTMLElement} element
 * @param {'pdf'|'image'} type
 * @param {string} baseName 확장자 없는 파일명
 * @returns {Promise<File>}
 */
export async function buildReportExportFile(element, type, baseName) {
  document.body.classList.add('pdf-export-mode')
  try {
    return type === 'image' ? await createReportImageFile(element, baseName) : await createReportPdfFile(element, baseName)
  } finally {
    document.body.classList.remove('pdf-export-mode')
  }
}

/** 만든 파일을 휴대폰에 저장 — 알림 끝에 붙일 위치 안내를 돌려준다. @param {File} file */
export function downloadFile(file) {
  return saveFileToDevice(file, file.name)
}
