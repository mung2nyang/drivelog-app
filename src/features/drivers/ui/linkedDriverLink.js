// @ts-check
/** @typedef {import('../../../domain/driverTypes.ts').DriverRecord} DriverRecord */
/** @typedef {import('../../../domain/financeTypes.ts').DriverLinkLike} DriverLinkLike */

/**
 * @param {DriverRecord} driver
 * @returns {DriverLinkLike & { driverName?: string, phone?: string }}
 */
export function toLinkedDriverLink(driver) {
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
