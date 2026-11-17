import type { DailyLogRow } from '../hydrate/hydrateMergeTypes.ts'
import type { JsonValue } from '../../domain/jsonTypes.ts'

const versions = new Map<string, string>()

function keyOf(vehicleId: number | string, dateKey: string) {
  return `${String(vehicleId)}|${dateKey}`
}

export function dayLogVersion(vehicleId: number | string, dateKey: string): string | null {
  return versions.get(keyOf(vehicleId, dateKey)) ?? null
}

export function setDayLogVersion(vehicleId: number | string, dateKey: string, value: JsonValue | undefined) {
  const key = keyOf(vehicleId, dateKey)
  if (typeof value === 'string' && value !== '') versions.set(key, value)
  else versions.delete(key)
}

export function rememberDayLogVersions(vehicleId: number | string, rows: ReadonlyArray<DailyLogRow> | null | undefined) {
  const prefix = `${String(vehicleId)}|`
  for (const key of [...versions.keys()]) {
    if (key.startsWith(prefix)) versions.delete(key)
  }
  for (const row of rows || []) setDayLogVersion(vehicleId, row.work_date, row.updated_at)
}

