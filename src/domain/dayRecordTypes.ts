import type { CallDetailLike } from './callDetail.ts'
import type { JsonRecord } from './jsonTypes.ts'

export type DayRecordLike = {
  isOff?: boolean
  fixedCount?: number
  palletCount?: number
  callDetails?: Array<CallDetailLike>
  fixedRouteCounts?: Record<string, number>
  dailyDistance?: number
  fuelItems?: Array<JsonRecord>
  maintItems?: Array<JsonRecord>
  miscItems?: Array<JsonRecord>
  assignedVehicleNumber?: string
}
