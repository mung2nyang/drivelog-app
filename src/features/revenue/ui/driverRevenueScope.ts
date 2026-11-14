import type { CarLike, FinanceSettings, WorkDataByLogId } from '../../../domain/financeTypes.ts'

export function scopeWorkDataToVehicle(workDataByLogId: WorkDataByLogId|null|undefined, vehicleNumber: string|null|undefined): WorkDataByLogId {
  if (!vehicleNumber) return {}
  const data = workDataByLogId?.[vehicleNumber]
  return { [vehicleNumber]: data && typeof data === 'object' ? data : {} }
}

export function scopeSettingsToVehicle(settings: FinanceSettings, vehicleNumber: string|null|undefined): FinanceSettings {
  const cars = Array.isArray(settings?.cars) ? settings.cars : []
  if (!vehicleNumber) return { ...settings, cars: [] }
  return {
    ...settings,
    cars: cars.filter((car: CarLike) => car?.number === vehicleNumber),
  }
}
