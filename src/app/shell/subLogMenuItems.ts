import { getShortCarNum } from '../../domain/cars.ts'
import type { CarLike } from '../../domain/financeTypes.ts'

export type SubLogMenuItem = { number: string, label: string, driverName: string }

export function buildSubLogMenuItems(
  cars: Array<CarLike> | null | undefined,
  drivers: Array<{ status?: string, vehicleNumber?: string }> | null | undefined,
  isOwnerSession: boolean,
): Array<SubLogMenuItem> {
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
