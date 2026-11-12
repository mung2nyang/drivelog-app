import type { CallDetailLike } from './callDetail.ts'
import type { JsonRecord } from './jsonTypes.ts'

export type DayRecordLike = {
  isOff?: boolean
  fixedCount?: number
  palletCount?: number
  callDetails?: Array<CallDetailLike>
  fixedRouteCounts?: Record<string, number>
  fare?: number | string
  fixedFare?: number | string
  totalFare?: number | string
  count?: number
  dailyDistance?: number
  fuelItems?: Array<JsonRecord>
  maintItems?: Array<JsonRecord>
  miscItems?: Array<JsonRecord>
  assignedVehicleNumber?: string
}
