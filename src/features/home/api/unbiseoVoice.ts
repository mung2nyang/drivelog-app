// 운비서 목소리 함수(unbiseo-voice) 부르기 — 소리 파일만 받아 오고 저장하지 않는다.
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../../data/cloud/supabaseClient.ts'
import { usedUpMessage } from './unbiseoParse.ts'

const TEXT_MAX = 300
const VOICE_TIMEOUT_MS = 5000

/** 하루 목소리 횟수를 다 씀 — 소리 없이 이 문구만 알린다. */
export type VoiceUsedUp = { usedUp: string }

/** 답 문장 → mp3 소리. 다 썼으면 안내 문구, 그 밖의 오류·5초 넘음·빈 소리면 null(휴대폰 목소리로 대신 읽는다). */
export async function requestUnbiseoVoice(sentence: string): Promise<Blob | VoiceUsedUp | null> {
  const text = sentence.trim()
  if (!text || text.length > TEXT_MAX) return null
  try {
    const { data, error } = await supabase.functions.invoke('unbiseo-voice', { body: { text }, timeout: VOICE_TIMEOUT_MS })
    if (error) {
      const response = error instanceof FunctionsHttpError && error.context instanceof Response ? error.context : null
      return response?.status === 429 ? { usedUp: await usedUpMessage(response) } : null
    }
    if (!(data instanceof Blob) || data.size === 0) return null
    return new Blob([data], { type: 'audio/mpeg' })
  } catch {
    return null
  }
}
