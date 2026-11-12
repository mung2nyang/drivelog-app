import { dedupeCarsById, isCarFuelKind } from '../../domain/cars.ts'
import { isInsuranceSplit } from '../../domain/driverIncomeDeductions.ts'
import { COMM_TYPES, DRIVER_PAY_MODES, INFO_TYPES, isAllowedEnum } from '../store/persistDomainEnums.ts'
import {
  BUSINESS_INFO_KEYS, PERSONAL_INFO_KEYS, isPlainObject, isStringOrFiniteNumber, isStringRecord,
} from '../store/persistDomainRecords.ts'
import type { LocalCar, RawCarBackup, VehicleRow } from './hydrateMergeTypes.ts'

function stringOrEmpty(value: string | undefined) {
  return typeof value === 'string' ? value : ''
}

function boolOrFalse(value: boolean | undefined) {
  return typeof value === 'boolean' ? value : false
}

function boolOrOmit(value: boolean | undefined) {
  return typeof value === 'boolean' ? value : undefined
}

function numericOrEmpty(value: string | number | undefined) {
  return value !== undefined && isStringOrFiniteNumber(value) ? value : ''
}

function enumOrDefault(value: string | undefined, allowed: ReadonlyArray<string>, fallback: string) {
  return typeof value === 'string' && isAllowedEnum(value, allowed) ? value : fallback
}

export function mergeCarsFromRows(localCars: Array<LocalCar>, vehicleRows: Array<VehicleRow> | null | undefined) {
  if (!Array.isArray(vehicleRows)) {
    return Array.isArray(localCars) ? localCars : []
  }
  const cars = vehicleRows.map((row) => {
    const raw = row.raw && typeof row.raw === 'object' ? row.raw : ({}) as RawCarBackup
    const rawId = raw.id == null || raw.id === '' ? '' : String(raw.id)
    const car: LocalCar = {
      id: rawId || `car-${row.id}`,
      number: row.number || '',
      type: row.type === 'sub' ? 'sub' : 'main',
      tonnage: row.tonnage || '',
      supabaseId: row.id,
      driverName: stringOrEmpty(row.driver_name ?? raw.driverName),
      driverPhone: stringOrEmpty(raw.driverPhone),
      driverLinkId: stringOrEmpty(raw.driverLinkId),
      driverPayMode: enumOrDefault(row.driver_pay_mode ?? raw.driverPayMode, DRIVER_PAY_MODES, 'revenue'),
      driverSalaryAmount: numericOrEmpty(row.driver_salary_amount ?? raw.driverSalaryAmount),
      commEnabled: boolOrFalse(row.comm_enabled ?? raw.commEnabled),
      commType: enumOrDefault(row.comm_type ?? raw.commType, COMM_TYPES, 'percent'),
      commission: numericOrEmpty(row.comm_value ?? raw.commission),
      infoType: enumOrDefault(raw.infoType, INFO_TYPES, 'existing'),
    }
    const insuranceOn = boolOrOmit(raw.insuranceOn)
    if (insuranceOn !== undefined) car.insuranceOn = insuranceOn
    const withholdingOn = boolOrOmit(raw.withholdingOn)
    if (withholdingOn !== undefined) car.withholdingOn = withholdingOn
    if (raw.driverIncomeType === 'employee' || raw.driverIncomeType === 'business') car.driverIncomeType = raw.driverIncomeType
    if (raw.expenseRate !== undefined && isStringOrFiniteNumber(raw.expenseRate)) car.expenseRate = raw.expenseRate
    if (raw.insuranceRate !== undefined && isStringOrFiniteNumber(raw.insuranceRate)) car.insuranceRate = raw.insuranceRate
    if (isInsuranceSplit(raw.insuranceSplit)) car.insuranceSplit = raw.insuranceSplit
    if (raw.driverShareBase === 'gross' || raw.driverShareBase === 'afterClientCommission') car.driverShareBase = raw.driverShareBase
    if (isCarFuelKind(raw.fuelKind)) car.fuelKind = raw.fuelKind
    const logEnabled = boolOrOmit(raw.logEnabled)
    if (logEnabled !== undefined) car.logEnabled = logEnabled
    const driverLinkEnabled = boolOrOmit(raw.driverLinkEnabled)
    if (driverLinkEnabled !== undefined) car.driverLinkEnabled = driverLinkEnabled
    const shareRevenueWithOwner = boolOrOmit(raw.shareRevenueWithOwner)
    if (shareRevenueWithOwner !== undefined) car.shareRevenueWithOwner = shareRevenueWithOwner
    const archived = boolOrOmit(raw.archived)
    if (archived !== undefined) car.archived = archived
    if (isPlainObject(raw.personalInfo ?? null) && isStringRecord(raw.personalInfo ?? null, PERSONAL_INFO_KEYS)) {
      car.personalInfo = raw.personalInfo
    }
    if (isPlainObject(raw.businessInfo ?? null) && isStringRecord(raw.businessInfo ?? null, BUSINESS_INFO_KEYS)) {
      car.businessInfo = raw.businessInfo
    }
    return car
  })
  const unsynced = (localCars || []).filter((car) => car && !car.supabaseId)
  return dedupeCarsById([...cars, ...unsynced])
}
