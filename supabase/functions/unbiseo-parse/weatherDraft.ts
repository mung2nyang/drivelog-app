import type { Json } from './question.ts'

export type WeatherDraft = { date: string, place: string }

const PLACE_MAX = 30

function isDateKey(value: Json | undefined): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

export function readWeatherDraft(row: { [key: string]: Json }, today: string): WeatherDraft {
  const place = typeof row.weatherPlace === 'string' ? row.weatherPlace.trim().slice(0, PLACE_MAX) : ''
  return { date: isDateKey(row.weatherDate) ? row.weatherDate : today, place }
}
