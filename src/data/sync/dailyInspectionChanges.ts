export type DailyInspectionChange = { vehicleId: string | number, workDate: string, saved: boolean }

const listeners = new Set<(change: DailyInspectionChange) => void>()

export function notifyDailyInspectionChanged(change: DailyInspectionChange) {
  listeners.forEach((listener) => listener(change))
}

export function subscribeDailyInspectionChanges(listener: (change: DailyInspectionChange) => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
