import { useCallback, useEffect, useRef, useState } from 'react'
import { requestUnbiseoVoice } from '../api/unbiseoVoice.ts'
import { isApp, speakInApp, stopSpeakingInApp } from './appSpeech.ts'

type Reading = { audio: HTMLAudioElement | null, url: string, onDevice: boolean }

function engine(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !window.speechSynthesis) return null
  return typeof window.SpeechSynthesisUtterance === 'function' ? window.speechSynthesis : null
}

function canPlayAudio(): boolean {
  return typeof window !== 'undefined' && typeof window.Audio === 'function' && typeof URL.createObjectURL === 'function'
}

function cancelOnDevice() {
  if (isApp()) void stopSpeakingInApp()
  else engine()?.cancel()
}

function releaseSound(reading: Reading) {
  reading.audio?.pause()
  reading.audio = null
  if (reading.url) URL.revokeObjectURL(reading.url)
  reading.url = ''
}

export default function useSpeechOutput(onUsedUp?: (message: string) => void) {
  const [speaking, setSpeaking] = useState(false)
  const currentRef = useRef<Reading | null>(null)
  const supported = isApp() || engine() !== null || canPlayAudio()

  const end = useCallback((reading: Reading) => {
    releaseSound(reading)
    if (currentRef.current !== reading) return
    currentRef.current = null
    setSpeaking(false)
  }, [])

  const stop = useCallback(() => {
    const reading = currentRef.current
    currentRef.current = null
    setSpeaking(false)
    if (!reading) return
    releaseSound(reading)
    if (reading.onDevice) cancelOnDevice()
  }, [])

  const speakOnDevice = useCallback((sentence: string, reading: Reading) => {
    if (reading.onDevice) return
    const app = isApp()
    const synth = app ? null : engine()
    releaseSound(reading)
    if ((!app && !synth) || currentRef.current !== reading) { end(reading); return }
    reading.onDevice = true
    if (app) { void speakInApp(sentence).then(() => end(reading)); return }
    if (!synth) return
    const utterance = new window.SpeechSynthesisUtterance(sentence)
    utterance.lang = 'ko-KR'
    utterance.onend = () => end(reading)
    utterance.onerror = () => end(reading)
    synth.speak(utterance)
  }, [end])

  const speak = useCallback((sentence: string) => {
    if (!sentence || (!isApp() && !engine() && !canPlayAudio())) return
    stop()
    const reading: Reading = { audio: null, url: '', onDevice: false }
    currentRef.current = reading
    setSpeaking(true)
    const sound = canPlayAudio() ? requestUnbiseoVoice(sentence) : Promise.resolve(null)
    void sound.then((blob) => {
      if (currentRef.current !== reading) return
      if (blob && !(blob instanceof Blob)) { end(reading); onUsedUp?.(blob.usedUp); return }
      if (!blob) { speakOnDevice(sentence, reading); return }
      reading.url = URL.createObjectURL(blob)
      const audio = new window.Audio(reading.url)
      reading.audio = audio
      audio.onended = () => end(reading)
      audio.onerror = () => speakOnDevice(sentence, reading)
      audio.play().catch(() => speakOnDevice(sentence, reading))
    })
  }, [stop, end, speakOnDevice, onUsedUp])

  useEffect(() => () => {
    const reading = currentRef.current
    currentRef.current = null
    if (!reading) return
    releaseSound(reading)
    if (reading.onDevice) cancelOnDevice()
  }, [])

  return { supported, speaking, speak, stop }
}
