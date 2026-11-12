import * as v from 'valibot'
import { bool, by, finiteNumber, isPlainObject, opt, str, stringOrNumber } from '../../domain/schemaParts.ts'
import {
  CAR_SETTLEMENT_MODES, COMM_TYPES, DRIVER_PAY_MODES, INFO_TYPES, PAYMENT_TERM_VALUES,
} from './persistDomainEnums.ts'
import { CAR_FUEL_KINDS } from '../../domain/cars.ts'
import type { JsonValue } from '../../domain/jsonTypes.ts'

export { isPlainObject }

function isFiniteNumber(value: JsonValue) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isStringOrFiniteNumber(value: JsonValue) {
  return typeof value === 'string' || isFiniteNumber(value)
}

function hasOnlyKeys(value: Record<string, JsonValue>, allowed: ReadonlyArray<string>) {
  const set = new Set(allowed)
  return Object.keys(value).every((key) => set.has(key))
}

const PERSONAL_INFO_KEYS = [
  'driverName', 'bizNumber', 'name', 'address', 'bizType', 'bizItem', 'email',
  'phone', 'bank', 'account', 'accountHolder',
]
const BUSINESS_INFO_KEYS = ['sameAsOwner', 'name', 'bizNumber', 'representative', 'address', 'bizType', 'bizItem', 'email']
export function isStringRecord(value: JsonValue, keys: ReadonlyArray<string>) {
  if (!isPlainObject(value) || !hasOnlyKeys(value, keys)) return false
  return Object.entries(value).every(([key, field]) => (key === 'sameAsOwner' ? typeof field === 'boolean' : typeof field === 'string'))
}

export { PERSONAL_INFO_KEYS, BUSINESS_INFO_KEYS }

const CAR = v.strictObject({
  number: str,
  id: opt(str), supabaseId: opt(stringOrNumber), tonnage: opt(str), type: opt(v.picklist(['main', 'sub'])), fuelKind: opt(v.picklist(CAR_FUEL_KINDS)),
  settlementMode: opt(v.picklist(CAR_SETTLEMENT_MODES)),
  commEnabled: opt(bool), commType: opt(v.picklist(COMM_TYPES)), commission: opt(stringOrNumber),
  insuranceOn: opt(bool), withholdingOn: opt(bool), logEnabled: opt(bool), driverLinkEnabled: opt(bool), shareRevenueWithOwner: opt(bool), archived: opt(bool),
  driverIncomeType: opt(v.picklist(['employee', 'business'])), expenseRate: opt(stringOrNumber), insuranceRate: opt(stringOrNumber),
  insuranceSplit: opt(v.picklist(['owner', 'half', 'driver'])),
  driverName: opt(str), driverPhone: opt(str), driverLinkId: opt(str), driverPayMode: opt(v.picklist(DRIVER_PAY_MODES)), driverSalaryAmount: opt(str),
  infoType: opt(v.picklist(INFO_TYPES)), driverShareBase: opt(v.picklist(['gross', 'afterClientCommission'])),
  personalInfo: opt(by((value) => isStringRecord(value, PERSONAL_INFO_KEYS))),
  businessInfo: opt(by((value) => isStringRecord(value, BUSINESS_INFO_KEYS))),
})

const CLIENT = v.strictObject({
  id: str,
  companyName: str,
  isPinned: opt(bool), commEnabled: opt(bool), fixedRouteLinked: opt(bool), palletOn: opt(bool),
  commValue: opt(stringOrNumber), palletPrice: opt(stringOrNumber), fixedUnitPrice: opt(stringOrNumber), supabaseId: opt(stringOrNumber),
  paymentTerm: opt(v.picklist(PAYMENT_TERM_VALUES)), commType: opt(v.picklist(COMM_TYPES)), paymentTermValue: opt(str),
  managerName: opt(str), phone: opt(str), bizNumber: opt(str), scopedToVehicleNumber: opt(str),
  taxRepresentative: opt(str), taxEmail: opt(str), taxAddress: opt(str), taxBizType: opt(str), taxBizItem: opt(str),
})

const EXPENSE = v.strictObject({
  id: str,
  date: str,
  kind: v.picklist(['maint', 'fuel', 'misc']),
  name: opt(str), category: opt(str), fuelType: opt(str), payment: opt(str), vehicleNumber: opt(str),
  cost: opt(finiteNumber), subsidy: opt(finiteNumber), mileage: opt(finiteNumber), liters: opt(stringOrNumber),
})

const DRIVER = v.strictObject({
  id: str,
  status: opt(v.picklist(['pending', 'linked'])), supabaseId: opt(stringOrNumber),
  name: opt(str), phone: opt(str), vehicleNumber: opt(str), startDate: opt(str), endDate: opt(str), inviteCode: opt(str),
})

export function isPersistedCar(value: JsonValue) {
  return v.is(CAR, value)
}

export function isPersistedClient(value: JsonValue) {
  return v.is(CLIENT, value)
}

export function isPersistedExpense(value: JsonValue) {
  return v.is(EXPENSE, value)
}

export function isPersistedDriver(value: JsonValue) {
  return v.is(DRIVER, value)
}
