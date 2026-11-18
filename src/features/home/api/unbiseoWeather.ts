import { FunctionsHttpError } from '@supabase/supabase-js'
import type { JsonValue } from '../../../domain/jsonTypes.ts'
import { supabase } from '../../../data/cloud/supabaseClient.ts'
import { kmaGridOf } from './kmaGrid.ts'
import type { KmaGrid } from './kmaGrid.ts'
import { LOGIN_NEEDED, TRY_LATER, usedUpMessage } from './unbiseoParse.ts'
import type { UnbiseoWeather } from './unbiseoParse.ts'
import { withParticle } from './unbiseoSentence.ts'

type Sky = 'clear' | 'mostlyCloudy' | 'cloudy'
type Precip = 'rain' | 'rainSnow' | 'snow' | 'shower'
type DayWeather = { sky: Sky | null, precip: Precip | null, min: number | null, max: number | null, pop: number | null }

export const WEATHER_PAST = '과거 날씨는 안내하지 않아요.'
export const WEATHER_TOO_FAR = '날씨는 모레까지 확인할 수 있어요.'
export const NO_LOCATION = '위치 정보 사용을 허용하거나 지역명을 말해 주세요.'
const LOCATION_TIMEOUT_MS = 10000
const LOCATION_MAX_AGE_MS = 600000
const DAY_LABELS = ['오늘', '내일', '모레']
const SKY_WORDS: { [sky in Sky]: [string, string] } = { clear: ['맑음', '맑고'], mostlyCloudy: ['구름 많음', '구름 많고'], cloudy: ['흐림', '흐리고'] }
const PRECIP_WORDS: { [precip in Precip]: string } = { rain: '비', rainSnow: '비나 눈', snow: '눈', shower: '소나기' }

function record(value: JsonValue | undefined): { [key: string]: JsonValue } | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function daysFrom(today: string, date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
}

export function weatherRangeSentence(date: string, today: string): string | null {
  const days = daysFrom(today, date)
  if (days < 0) return WEATHER_PAST
  return days > 2 ? WEATHER_TOO_FAR : null
}

export function currentGrid(): Promise<KmaGrid | null> {
  const geo = typeof navigator === 'undefined' ? undefined : navigator.geolocation
  if (!geo) return Promise.resolve(null)
  return new Promise((resolve) => {
    geo.getCurrentPosition(
      (position) => resolve(kmaGridOf(position.coords.latitude, position.coords.longitude)),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: LOCATION_TIMEOUT_MS, maximumAge: LOCATION_MAX_AGE_MS },
    )
  })
}

function numberOf(value: JsonValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readDay(row: { [key: string]: JsonValue }): DayWeather {
  const sky = row.sky === 'clear' || row.sky === 'mostlyCloudy' || row.sky === 'cloudy' ? row.sky : null
  const precip = row.precip === 'rain' || row.precip === 'rainSnow' || row.precip === 'snow' || row.precip === 'shower' ? row.precip : null
  const pop = numberOf(row.pop)
  return { sky, precip, min: numberOf(row.min), max: numberOf(row.max), pop: pop !== null && pop >= 0 && pop <= 100 ? pop : null }
}

function temperatureTip({ min, max }: DayWeather): string {
  if (min !== null && min <= -10) return '매우 추워요. 따뜻하게 입으세요.'
  if (min !== null && min <= 0) return '추워요. 따뜻하게 입으세요.'
  if (max !== null && max <= 12) return '쌀쌀해요.'
  if (max !== null && max >= 33) return '무척 더워요. 물 자주 드세요.'
  if (max !== null && max >= 28) return '더워요.'
  return min !== null && max !== null && max - min >= 10 ? '아침저녁으로 쌀쌀해요.' : ''
}

function precipTip({ precip, pop }: DayWeather): string {
  if (precip === 'snow' || precip === 'rainSnow') return '눈길 운전 조심하세요.'
  if (precip === 'rain' || precip === 'shower') return '비가 오니 우산 챙기세요.'
  return pop !== null && pop >= 60 ? '비가 올 수 있으니 우산 챙기세요.' : ''
}

export function weatherTip(day: DayWeather): string {
  const tips = [temperatureTip(day), precipTip(day)].filter(Boolean)
  if (tips.length) return tips.join(' ')
  return day.min !== null && day.max !== null && day.pop !== null ? '다니기 좋은 날씨예요.' : ''
}

export function describeWeather(day: DayWeather, weather: UnbiseoWeather, today: string): string {
  const where = weather.place ? `${weather.place} 날씨는` : '지금 있는 곳 날씨는'
  const skyWord = day.sky ? SKY_WORDS[day.sky] : null
  const precip = day.precip ? PRECIP_WORDS[day.precip] : ''
  const look = precip ? [skyWord?.[1], precip].filter(Boolean).join(' ') : skyWord?.[0] ?? ''
  const temps = day.min !== null && day.max !== null ? `최저 ${day.min}도, 최고 ${day.max}도` : day.min !== null ? `최저 ${day.min}도` : day.max !== null ? `최고 ${day.max}도` : ''
  const parts = [look, temps, day.pop === null ? '' : `비 올 확률 ${day.pop}%`].filter(Boolean)
  const head = `${DAY_LABELS[daysFrom(today, weather.date)] ?? ''} ${where}`.trim()
  if (!parts.length) return TRY_LATER
  return [`${head} ${withParticle(parts.join(', '), '이에요', '예요')}.`, weatherTip(day)].filter(Boolean).join(' ')
}

function sentenceOf(data: JsonValue | undefined, weather: UnbiseoWeather, today: string): string {
  const row = record(data)
  const day = record(row?.weather)
  if (row?.kind === 'weather' && day) return describeWeather(readDay(day), weather, today)
  if (row?.kind === 'past') return WEATHER_PAST
  if (row?.kind === 'tooFar') return WEATHER_TOO_FAR
  if (row?.kind === 'noPlace' && weather.place) return `${weather.place} 지역을 찾지 못했어요. 시, 군, 구 이름을 말해 주세요.`
  return TRY_LATER
}

export async function requestWeatherSentence(weather: UnbiseoWeather, today: string): Promise<string> {
  const range = weatherRangeSentence(weather.date, today)
  if (range) return range
  const grid = weather.place ? null : await currentGrid()
  if (!weather.place && !grid) return NO_LOCATION
  const body = grid ? { date: weather.date, nx: grid.nx, ny: grid.ny } : { date: weather.date, place: weather.place }
  try {
    const { data, error } = await supabase.functions.invoke('unbiseo-weather', { body })
    const context = error instanceof FunctionsHttpError && error.context instanceof Response ? error.context : null
    if (context?.status === 429) return await usedUpMessage(context)
    if (error) return context?.status === 401 ? LOGIN_NEEDED : TRY_LATER
    return sentenceOf(data, weather, today)
  } catch {
    return TRY_LATER
  }
}
