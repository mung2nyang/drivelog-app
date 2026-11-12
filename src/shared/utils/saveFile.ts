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

function numberedName(name: string, number: number) {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return `${name} (${number})`
  return `${name.slice(0, dot)} (${number})${name.slice(dot)}`
}

export async function saveFileToDevice(blob: Blob, name: string) {
  if (!Capacitor.isNativePlatform()) {
    downloadByLink(blob, name)
    return ''
  }
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const data = await blobToBase64(blob)
  let firstError: Error | null = null
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
