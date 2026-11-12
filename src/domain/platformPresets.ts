import type { JsonValue } from './jsonTypes.ts'
import type { FinanceSettings } from './financeTypes.ts'

export const PLATFORM_PRESET_DEFAULTS: ReadonlyArray<string> = ['24시콜', '화물맨', '더운반', '원콜', '전국화물콜', '카카오T트럭커']
export const PLATFORM_PRESET_MAX = 9
export const PLATFORM_PRESET_FULL = `플랫폼 칩은 최대 ${PLATFORM_PRESET_MAX}개입니다. 칩을 길게 눌러 하나를 지워 주세요.`

export function normalizePlatformPresets(value: JsonValue | undefined): Array<string> {
  if (!Array.isArray(value)) return [...PLATFORM_PRESET_DEFAULTS]
  const result: Array<string> = []
  for (const item of value) {
    const name = typeof item === 'string' ? item.trim() : ''
    if (name && !result.includes(name) && result.length < PLATFORM_PRESET_MAX) result.push(name)
  }
  return result
}

export function addPlatformPreset(settings: FinanceSettings, name: string): { settings: FinanceSettings, error?: string } {
  const trimmed = String(name || '').trim()
  const presets = normalizePlatformPresets(settings.platformPresets)
  if (!trimmed || presets.includes(trimmed)) return { settings }
  if (presets.length >= PLATFORM_PRESET_MAX) return { settings, error: PLATFORM_PRESET_FULL }
  return { settings: { ...settings, platformPresets: [...presets, trimmed] } }
}

export function removePlatformPreset(settings: FinanceSettings, name: string): { settings: FinanceSettings } {
  const trimmed = String(name || '').trim()
  const presets = normalizePlatformPresets(settings.platformPresets)
  if (!presets.includes(trimmed)) return { settings }
  return { settings: { ...settings, platformPresets: presets.filter((item) => item !== trimmed) } }
}
