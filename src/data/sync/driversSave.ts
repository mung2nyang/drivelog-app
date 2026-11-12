import { commitDrivers } from '../store/commitHelpers.ts'
import type { DriverRecord } from '../../domain/driverTypes.ts'

export function saveDrivers(ownerKey: string, items: DriverRecord[]) {
  commitDrivers(ownerKey, items)
}
