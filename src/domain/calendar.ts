import { isValidCalendarDateKey } from './dateKey.ts'

export function getYearOptions() {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let y = currentYear - 10; y <= currentYear + 10; y++) {
    years.push(y)
  }
  return years
}

export function shiftMonth(viewDate: Date, delta: number) {
  return new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1)
}

export function setYearMonth(viewDate: Date, year: number, month: number) {
  return new Date(year, month, 1)
}

export function buildCalendarCells(viewDate: Date) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const today = new Date()

  const firstDay = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()
  const totalWeeks = Math.ceil((firstDay + lastDate) / 7)
  const totalVisibleCells = totalWeeks * 7

  const cells = []
  for (let i = 0; i < totalVisibleCells; i++) {
    const dayIndex = i - firstDay + 1
    if (dayIndex >= 1 && dayIndex <= lastDate) {
      const dayOfWeek = new Date(year, month, dayIndex).getDay()
      const isToday =
        dayIndex === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear()

      cells.push({
        key: `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIndex).padStart(2, '0')}`,
        day: dayIndex,
        empty: false,
        sunday: dayOfWeek === 0,
        saturday: dayOfWeek === 6,
        today: isToday,
      })
    } else {
      cells.push({ key: `pad-${i}`, empty: true })
    }
  }
  return cells
}

export function todayWorkLogSelection(date = new Date()) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return {
    dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    month,
    day,
  }
}

export function parseDateKeySelection(dateKey: string | undefined): { dateKey: string, month: number, day: number } | null {
  if (!dateKey || !isValidCalendarDateKey(dateKey)) return null
  return {
    dateKey,
    month: Number(dateKey.slice(5, 7)),
    day: Number(dateKey.slice(8, 10)),
  }
}
