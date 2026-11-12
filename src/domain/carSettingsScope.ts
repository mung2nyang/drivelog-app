import { defaultCarSettings } from './practiceSettings.ts'
import type { FinanceSettings } from './financeTypes.ts'

export function resolveLogSettings(settings: FinanceSettings, logId: string): FinanceSettings {
  if (!logId || logId === 'main') return settings
  return { ...settings, ...(settings.subCarSettings?.[logId] || defaultCarSettings(settings.subFixedOn ?? true)) }
}
