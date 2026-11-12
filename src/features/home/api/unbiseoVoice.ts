import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../../data/cloud/supabaseClient.ts'
import { usedUpMessage } from './unbiseoParse.ts'

const TEXT_MAX = 300
const VOICE_TIMEOUT_MS = 5000

export type VoiceUsedUp = { usedUp: string }

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
