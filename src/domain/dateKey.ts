const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidCalendarDateKey(dateKey: string): boolean {
  if (!DATE_KEY_RE.test(dateKey)) return false
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}
