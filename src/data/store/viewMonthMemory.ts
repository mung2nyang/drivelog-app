export type ViewMonthScreen = 'calendar' | 'revenue'

type Remembered = { ownerKey: string, year: number, month: number, yearly: boolean }

const memory = new Map<ViewMonthScreen, Remembered>()

export function recallViewMonth(screen: ViewMonthScreen, ownerKey: string): { viewDate: Date, yearly: boolean } | null {
  const saved = memory.get(screen)
  if (!saved || saved.ownerKey !== ownerKey) return null
  return { viewDate: new Date(saved.year, saved.month, 1), yearly: saved.yearly }
}

export function rememberViewMonth(screen: ViewMonthScreen, ownerKey: string, viewDate: Date, yearly = false): void {
  memory.set(screen, { ownerKey, year: viewDate.getFullYear(), month: viewDate.getMonth(), yearly })
}

export function forgetViewMonths(): void {
  memory.clear()
}
