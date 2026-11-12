export function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

export function parseDateValue(value: string) {
  if (value) {
    const [year, month, day] = value.split('-').map(Number)
    return { year, month, day }
  }
  const today = new Date()
  return { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() }
}

export function parseTimeValue(value: string) {
  if (value) {
    const [hour, minute] = value.split(':').map(Number)
    return { hour, minute }
  }
  const now = new Date()
  return { hour: now.getHours(), minute: now.getMinutes() }
}

export function parseCursor(type: 'date' | 'time', value: string) {
  return type === 'date'
    ? { ...parseDateValue(value), hour: 0, minute: 0 }
    : { year: 0, month: 1, day: 1, ...parseTimeValue(value) }
}
