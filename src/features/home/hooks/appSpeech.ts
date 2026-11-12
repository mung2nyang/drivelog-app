import { Capacitor } from '@capacitor/core'

export type AppListenFailure = 'denied' | 'silent' | 'failed'
export type AppListenResult = { text: string } | { failure: AppListenFailure }

const NO_SPEECH_ERRORS = ['No match', 'No speech input']

export function isApp() {
  return Capacitor.isNativePlatform()
}

export async function listenInApp(): Promise<AppListenResult> {
  const { SpeechRecognition } = await import('@capgo/capacitor-speech-recognition')
  try {
    const { speechRecognition } = await SpeechRecognition.requestPermissions()
    if (speechRecognition !== 'granted') return { failure: 'denied' }
    const { matches } = await SpeechRecognition.start({ language: 'ko-KR', maxResults: 1, partialResults: false, popup: false })
    const text = (matches?.[0] || '').trim()
    return text ? { text } : { failure: 'silent' }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return { failure: NO_SPEECH_ERRORS.includes(message) ? 'silent' : 'failed' }
  }
}

export async function stopListeningInApp() {
  const { SpeechRecognition } = await import('@capgo/capacitor-speech-recognition')
  await SpeechRecognition.stop().catch(() => {})
}

export async function speakInApp(sentence: string) {
  const { TextToSpeech } = await import('@capacitor-community/text-to-speech')
  await TextToSpeech.speak({ text: sentence, lang: 'ko-KR' }).catch(() => {})
}

export async function stopSpeakingInApp() {
  const { TextToSpeech } = await import('@capacitor-community/text-to-speech')
  await TextToSpeech.stop().catch(() => {})
}
