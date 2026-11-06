// 앱(안드로이드)일 때 받아쓰기·기본 목소리 — 웹뷰에는 크롬 받아쓰기가 없어 안드로이드 것을 쓴다.
import { Capacitor } from '@capacitor/core'

/** 'denied' 마이크 거절, 'silent' 못 알아들음, 'failed' 그 밖의 실패. */
export type AppListenFailure = 'denied' | 'silent' | 'failed'
export type AppListenResult = { text: string } | { failure: AppListenFailure }

const NO_SPEECH_ERRORS = ['No match', 'No speech input']

export function isApp() {
  return Capacitor.isNativePlatform()
}

/** 마이크 권한을 묻고 한 번 듣는다. 말이 끝나거나 멈추면 받아쓴 글자를 돌려준다. */
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

/** 다 읽거나 멈추거나 실패하면 끝난다(실패를 던지지 않음). */
export async function speakInApp(sentence: string) {
  const { TextToSpeech } = await import('@capacitor-community/text-to-speech')
  await TextToSpeech.speak({ text: sentence, lang: 'ko-KR' }).catch(() => {})
}

export async function stopSpeakingInApp() {
  const { TextToSpeech } = await import('@capacitor-community/text-to-speech')
  await TextToSpeech.stop().catch(() => {})
}
