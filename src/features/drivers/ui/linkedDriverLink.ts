import type { DriverRecord } from '../../../domain/driverTypes.ts'
import type { DriverLinkLike } from '../../../domain/financeTypes.ts'
export function toLinkedDriverLink(driver: DriverRecord): DriverLinkLike & { driverName?: string, phone?: string } {
  return {
    id: driver.id,
    vehicleNumber: driver.vehicleNumber || '',
    assignmentStart: driver.startDate || '',
    assignmentEnd: driver.endDate || '',
    status: driver.status,
    driverName: driver.name || '',
    phone: driver.phone || '',
  }
}
