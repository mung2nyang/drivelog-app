import * as v from 'valibot'
import type { JsonValue } from './jsonTypes.ts'

export function isPlainObject(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const opt = v.exactOptional
export const str = v.string()
export const bool = v.boolean()
export const finiteNumber = v.pipe(v.number(), v.finite())
export const stringOrNumber = v.union([str, finiteNumber])
export const nonEmptyString = v.pipe(str, v.nonEmpty())

export const by = (check: (value: JsonValue) => boolean) => v.custom((input) => check(input as JsonValue))

export const plain = <T extends v.GenericSchema>(schema: T, extra: (value: Record<string, JsonValue>) => boolean = () => true) =>
  v.pipe(by((input) => isPlainObject(input) && extra(input)), schema)
