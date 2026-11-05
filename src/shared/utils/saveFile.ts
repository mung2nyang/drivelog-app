// 파일을 휴대폰에 저장 — 앱은 문서/운행일지 폴더, 웹은 브라우저 내려받기.
import { Capacitor } from '@capacitor/core'

export const APP_SAVE_FOLDER = '운행일지'
export const APP_SAVED_HINT = ' 내 파일 > 문서 > 운행일지에서 볼 수 있어요.'

function downloadByLink(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/**
 * 저장에 성공하면 알림 끝에 붙일 위치 안내를 돌려준다(웹은 빈 문자열). 실패는 그대로 던진다.
 */
export async function saveFileToDevice(blob: Blob, name: string) {
  if (!Capacitor.isNativePlatform()) {
    downloadByLink(blob, name)
    return ''
  }
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  await Filesystem.writeFile({
    path: `${APP_SAVE_FOLDER}/${name}`,
    data: await blobToBase64(blob),
    directory: Directory.Documents,
    recursive: true,
  })
  return APP_SAVED_HINT
}
