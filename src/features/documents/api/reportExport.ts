import { saveFileToDevice } from '../../../shared/utils/saveFile.ts'

async function renderReportCanvas(element: HTMLElement, orientation?: 'portrait'|'landscape'): Promise<HTMLCanvasElement> {
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
  return await worker.get('canvas') as HTMLCanvasElement
}

export function imageMarginPx(width: number, orientation?: 'portrait'|'landscape'): { x: number, y: number } {
  const contentMm = orientation === 'landscape' ? 277 : 190
  return { x: Math.round((width * 10) / contentMm), y: Math.round((width * 12) / contentMm) }
}

function addWhiteMargin(canvas: HTMLCanvasElement, orientation?: 'portrait'|'landscape'): HTMLCanvasElement {
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

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG 이미지 생성 실패'))), 'image/png')
  })
}

export async function createReportImageFile(element: HTMLElement, baseName: string, { orientation }: { orientation?: 'portrait'|'landscape' } = {}): Promise<File> {
  const canvas = addWhiteMargin(await renderReportCanvas(element, orientation), orientation)
  const blob = await canvasToPngBlob(canvas)
  return new File([blob], `${baseName}.png`, { type: 'image/png' })
}

export async function createReportPdfFile(element: HTMLElement, baseName: string, { orientation = 'portrait' }: { orientation?: 'portrait'|'landscape' } = {}): Promise<File> {
  const mod = await import('html2pdf.js')
  const html2pdf = mod.default
  const opt: Parameters<InstanceType<(typeof html2pdf)['Worker']>['set']>[0] = {
    margin: [12, 10, 12, 10],
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation },
  }
  const blob = await html2pdf().set(opt).from(element).outputPdf('blob') as Blob
  return new File([blob], `${baseName}.pdf`, { type: 'application/pdf' })
}

export async function buildReportExportFile(element: HTMLElement, type: 'pdf'|'image', baseName: string): Promise<File> {
  document.body.classList.add('pdf-export-mode')
  try {
    return type === 'image' ? await createReportImageFile(element, baseName) : await createReportPdfFile(element, baseName)
  } finally {
    document.body.classList.remove('pdf-export-mode')
  }
}

export function downloadFile(file: File) {
  return saveFileToDevice(file, file.name)
}
