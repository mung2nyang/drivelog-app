import type { DayRecordLike } from './day-record.ts'
import type { ClientLike } from './clients.ts'

export type WorkDataByLogId = Record<string, Record<string, DayRecordLike>>

export type CarLike = {
  id?: string
  supabaseId?: string | number
  number: string
  tonnage?: string
  fuelKind?: '휘발유' | '경유' | '전기' | 'LPG'
  type?: 'main' | 'sub'
  commEnabled?: boolean
  commType?: string
  commission?: string | number
  insuranceOn?: boolean
  driverIncomeType?: 'employee' | 'business'
  withholdingOn?: boolean
  expenseRate?: string | number
  insuranceRate?: string | number
  insuranceSplit?: 'owner' | 'half' | 'driver'
  driverShareBase?: 'gross' | 'afterClientCommission'
  logEnabled?: boolean
  driverLinkEnabled?: boolean
  shareRevenueWithOwner?: boolean
  archived?: boolean
  driverName?: string
  driverPhone?: string
  driverLinkId?: string
  driverPayMode?: string
  driverSalaryAmount?: string | number
  infoType?: string
  personalInfo?: { driverName?: string, bizNumber?: string, name?: string, address?: string, bizType?: string, bizItem?: string, email?: string, phone?: string, bank?: string, account?: string, accountHolder?: string }
  businessInfo?: { sameAsOwner?: boolean, name?: string, bizNumber?: string, representative?: string, address?: string, bizType?: string, bizItem?: string, email?: string }
}

export type DriverLinkLike = {
  id?: string
  vehicleNumber?: string
  assignmentStart?: string
  assignmentEnd?: string
  status?: string
  driverName?: string
}

export type SupplierBiz = {
  sameAsOwner?: boolean
  name?: string
  bizNumber?: string
  representative?: string
  address?: string
  bizType?: string
  bizItem?: string
  email?: string
}

export type FinanceSettings = {
  cars?: Array<CarLike>
  clients?: Array<ClientLike>
  driverLinks?: Array<DriverLinkLike>
  driverHistory?: Array<DriverLinkLike>
  paymentOn?: boolean
  subPaymentOn?: boolean
  fixedOn?: boolean
  subFixedOn?: boolean
  unitPrice?: number | string
  bizName?: string
  bizNumber?: string
  bizRepresentative?: string
  userName?: string
  bizAddress?: string
  bizType?: string
  bizItem?: string
  bizEmail?: string
  theme?: 'light' | 'dark'
  themeFollowPhone?: boolean
  inputMode?: 'count' | 'fare'
  callDetail?: boolean
  timeOn?: boolean
  platformOn?: boolean
  distanceOn?: boolean
  cargoTonnageOn?: boolean
  dailyInspectionOn?: boolean
  notifOff?: Array<string>
  unbiseoDockOn?: boolean
  messageTemplates?: [string, string, string]
  reportShareMessage?: string
  fixedRouteOn?: boolean
  fixedRoutePresets?: Array<{ id: string, loadLoc: string, unloadLoc: string }>
  runCountToggle?: boolean
  runCountPresets?: Array<number>
  subFixedRouteOn?: boolean
  subFixedRoutePresets?: Array<{ id: string, loadLoc: string, unloadLoc: string }>
  subRunCountToggle?: boolean
  subRunCountPresets?: Array<number>
  pinnedLocations?: Array<string>
  platformPresets?: Array<string>
  dismissedNotices?: Array<string>
  subCarSettings?: Record<string, SubCarPracticeSettings>
}

export type SubCarPracticeSettings = {
  inputMode: 'count' | 'fare'
  callDetail: boolean
  timeOn: boolean
  platformOn: boolean
  distanceOn: boolean
  cargoTonnageOn: boolean
  dailyInspectionOn?: boolean
}
