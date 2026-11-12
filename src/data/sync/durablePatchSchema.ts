import { isValidCallDetail } from '../store/callDetailSchema.ts'
import type { JsonValue } from '../../domain/jsonTypes.ts'
import type { EffectivePatch } from './pendingWorkDataWritesTypes.ts'

function isPlainObject(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeInteger(value: JsonValue): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
}

const PATCH_KEYS = (['isOff', 'fixedCount', 'palletCount', 'callDetails', 'fixedRouteCounts']) as const

export function isValidPatch(value: JsonValue): value is EffectivePatch {
  if (!isPlainObject(value)) return false
  const keys = Object.keys(value)
  if (keys.length !== PATCH_KEYS.length) return false
  if (!PATCH_KEYS.every((key) => key in value)) return false
  if (typeof value.isOff !== 'boolean') return false
  if (!isNonNegativeInteger(value.fixedCount)) return false
  if (!isNonNegativeInteger(value.palletCount)) return false
  if (!Array.isArray(value.callDetails)) return false
  for (const item of value.callDetails) if (!isValidCallDetail(item)) return false
  if (!isPlainObject(value.fixedRouteCounts)) return false
  for (const v of Object.values(value.fixedRouteCounts)) if (!isNonNegativeInteger(v)) return false
  return true
}
