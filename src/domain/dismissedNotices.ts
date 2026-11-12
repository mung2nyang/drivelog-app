import type { JsonValue } from './jsonTypes.ts'
import type { FinanceSettings } from './financeTypes.ts'

export const DISMISSED_NOTICES_MAX = 200
const TODAY_PREFIX = 'today:'

function keepLast(ids: Array<string>): Array<string> {
  return ids.length > DISMISSED_NOTICES_MAX ? ids.slice(ids.length - DISMISSED_NOTICES_MAX) : ids
}

export function normalizeDismissedNotices(value: JsonValue | undefined): Array<string> {
  if (!Array.isArray(value)) return []
  const result: Array<string> = []
  for (const item of value) {
    const id = typeof item === 'string' ? item.trim() : ''
    if (id && !result.includes(id)) result.push(id)
  }
  return keepLast(result)
}

export function addDismissedNotices(settings: FinanceSettings, ids: Array<string>, today: string): FinanceSettings {
  const merged = normalizeDismissedNotices([...normalizeDismissedNotices(settings.dismissedNotices), ...ids])
  const fresh = merged.filter((id) => !id.startsWith(TODAY_PREFIX) || id === `${TODAY_PREFIX}${today}`)
  return { ...settings, dismissedNotices: keepLast(fresh) }
}
