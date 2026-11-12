// @ts-check

/** @typedef {import('../../../domain/financeTypes.ts').FinanceSettings} FinanceSettings */
/** @typedef {import('../../../domain/financeTypes.ts').WorkDataByLogId} WorkDataByLogId */
/** @typedef {import('../../../domain/financeTypes.ts').CarLike} CarLike */

/**
 * @param {WorkDataByLogId|null|undefined} workDataByLogId
 * @param {string|null|undefined} vehicleNumber
 * @returns {WorkDataByLogId}
 */
export function scopeWorkDataToVehicle(workDataByLogId, vehicleNumber) {
  if (!vehicleNumber) return {}
  const data = workDataByLogId?.[vehicleNumber]
  return { [vehicleNumber]: data && typeof data === 'object' ? data : {} }
}

/**
 * @param {FinanceSettings} settings
 * @param {string|null|undefined} vehicleNumber
 * @returns {FinanceSettings}
 */
export function scopeSettingsToVehicle(settings, vehicleNumber) {
  const cars = Array.isArray(settings?.cars) ? settings.cars : []
  if (!vehicleNumber) return { ...settings, cars: [] }
  return {
    ...settings,
    cars: cars.filter((/** @type {CarLike} */ car) => car?.number === vehicleNumber),
  }
}
