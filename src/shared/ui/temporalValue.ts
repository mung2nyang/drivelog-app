// TemporalInput/TemporalColumns가 공유하는 순수 날짜·시간 문자열 유틸.

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

/**
 * date/time 공용 cursor 상태 — 필드를 항상 다 채워서 union 타입 좁히기 문제를 피한다
 * (실제 쓰는 화면은 type에 맞는 절반뿐, 나머지는 무시됨).
 */
export function parseCursor(type: 'date' | 'time', value: string) {
  return type === 'date'
    ? { ...parseDateValue(value), hour: 0, minute: 0 }
    : { year: 0, month: 1, day: 1, ...parseTimeValue(value) }
}
