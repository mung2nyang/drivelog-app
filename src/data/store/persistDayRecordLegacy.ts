import * as v from 'valibot'
import { isValidCurrencyAmount } from './callDetailSchema.ts'
import { by, finiteNumber, nonEmptyString, opt, plain, str, stringOrNumber } from '../../domain/schemaParts.ts'
import type { JsonValue } from '../../domain/jsonTypes.ts'

const money = v.union([finiteNumber, by(isValidCurrencyAmount)])

const FUEL_ITEM = plain(v.strictObject({
  type: nonEmptyString, cost: money, subsidy: opt(money), liter: opt(stringOrNumber), liters: opt(stringOrNumber), mileage: opt(stringOrNumber),
}))

const MAINT_FIELDS = { name: nonEmptyString, fare: money, mileage: opt(stringOrNumber), category: opt(str), payment: opt(str) }
const MAINT_ITEM = plain(v.strictObject(MAINT_FIELDS))
const MISC_ITEM = plain(v.strictObject({ ...MAINT_FIELDS, id: opt(nonEmptyString) }))

export function isPersistedFuelItem(value: JsonValue) {
  return v.is(FUEL_ITEM, value)
}

export function isPersistedMaintItem(value: JsonValue) {
  return v.is(MAINT_ITEM, value)
}

export function isPersistedMiscItem(value: JsonValue) {
  return v.is(MISC_ITEM, value)
}

function isItemList(value: JsonValue, check: (item: JsonValue) => boolean) {
  return Array.isArray(value) && value.every(check)
}

export function isPersistedFuelList(value: JsonValue) {
  return isItemList(value, isPersistedFuelItem)
}

export function isPersistedMaintList(value: JsonValue) {
  return isItemList(value, isPersistedMaintItem)
}

export function isPersistedMiscList(value: JsonValue) {
  return isItemList(value, isPersistedMiscItem)
}
