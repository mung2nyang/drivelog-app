import { Capacitor } from '@capacitor/core'
import { blobToBase64 } from './saveFile.ts'

const APP_SHARE_FOLDER = 'share'
const APP_SHARE_CANCELED = 'Share canceled'

type ShareText = { title: string, text: string }

async function shareInBrowser(file: File, { title, text }: ShareText) {
  if (typeof navigator.share !== 'function') return false
  if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) return false
  try {
    await navigator.share({ files: [file], title, text })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return true
    throw error
  }
  return true
}

export async function shareFileFromDevice(file: File, { title, text }: ShareText) {
  if (!Capacitor.isNativePlatform()) return shareInBrowser(file, { title, text })
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
  const { uri } = await Filesystem.writeFile({
    path: `${APP_SHARE_FOLDER}/${file.name}`,
    data: await blobToBase64(file),
    directory: Directory.Cache,
    recursive: true,
  })
  try {
    await Share.share({ files: [uri], title, text, dialogTitle: title })
  } catch (error) {
    if (error instanceof Error && error.message === APP_SHARE_CANCELED) return true
    throw error
  }
  return true
}
