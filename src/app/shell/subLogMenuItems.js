// @ts-check
import { getShortCarNum } from '../../domain/cars.ts'

/** @typedef {import('../../domain/financeTypes.ts').CarLike} CarLike */
/** @typedef {{ number: string, label: string, driverName: string }} SubLogMenuItem */

/**
 * @param {Array<CarLike>|null|undefined} cars
 * @param {Array<{ status?: string, vehicleNumber?: string }>|null|undefined} drivers
 * @param {boolean} isOwnerSession
 * @returns {Array<SubLogMenuItem>}
 */
export function buildSubLogMenuItems(cars, drivers, isOwnerSession) {
  if (!isOwnerSession) return []
  const linkedNumbers = new Set(
    (Array.isArray(drivers) ? drivers : [])
      .filter((driver) => {
        const status = String(driver?.status || '')
        const number = String(driver?.vehicleNumber || '').trim()
        return status !== 'disconnected' && number !== ''
      })
      .map((driver) => String(driver.vehicleNumber).trim()),
  )
  return (Array.isArray(cars) ? cars : [])
    .filter((car) => {
      const number = String(car?.number || '').trim()
      return car?.type === 'sub' && number && !linkedNumbers.has(number)
    })
    .map((car) => {
      const number = String(car.number || '').trim()
      return {
        number,
        label: getShortCarNum(number),
        driverName: String(car.driverName || '').trim(),
      }
    })
}
