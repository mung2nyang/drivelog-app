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

export async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

const MAX_NAME_NUMBER = 5

/** `이름.pdf` → `이름 (2).pdf`, 확장자가 없으면 끝에 붙인다. */
function numberedName(name: string, number: number) {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return `${name} (${number})`
  return `${name.slice(0, dot)} (${number})${name.slice(dot)}`
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
  const data = await blobToBase64(blob)
  let firstError: Error | null = null
  // 앱을 다시 깔면 예전 앱이 만든 같은 이름 파일은 덮어쓸 수 없어, 번호를 붙여 새로 저장한다.
  for (let number = 1; number <= MAX_NAME_NUMBER; number += 1) {
    const fileName = number === 1 ? name : numberedName(name, number)
    try {
      await Filesystem.writeFile({
        path: `${APP_SAVE_FOLDER}/${fileName}`,
        data,
        directory: Directory.Documents,
        recursive: true,
      })
      return APP_SAVED_HINT
    } catch (error) {
      if (!firstError) firstError = error instanceof Error ? error : new Error(String(error))
    }
  }
  throw firstError
}
