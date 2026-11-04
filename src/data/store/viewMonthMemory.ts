// 달력·매출에서 마지막에 본 달 — 앱이 켜져 있는 동안만 기억한다(휴대폰에 저장하지 않아 다시 켜면 이번 달).
export type ViewMonthScreen = 'calendar' | 'revenue'

type Remembered = { ownerKey: string, year: number, month: number, yearly: boolean }

const memory = new Map<ViewMonthScreen, Remembered>()

/** 그 계정이 그 화면에서 마지막에 본 달(매출은 년 매출 탭인지도). 없거나 다른 계정이면 null. */
export function recallViewMonth(screen: ViewMonthScreen, ownerKey: string): { viewDate: Date, yearly: boolean } | null {
  const saved = memory.get(screen)
  if (!saved || saved.ownerKey !== ownerKey) return null
  return { viewDate: new Date(saved.year, saved.month, 1), yearly: saved.yearly }
}

export function rememberViewMonth(screen: ViewMonthScreen, ownerKey: string, viewDate: Date, yearly = false): void {
  memory.set(screen, { ownerKey, year: viewDate.getFullYear(), month: viewDate.getMonth(), yearly })
}

/** 앱을 다시 켠 것과 같게 — 시험에서만 쓴다. */
export function forgetViewMonths(): void {
  memory.clear()
}
