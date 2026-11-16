import { readOwnerCars } from '../../../data/store/ownerDataHooks.ts'
import { isPlainObject } from '../../../data/store/persistDomainRecords.ts'
import { isValidCalendarDateKey } from '../../../domain/dateKey.ts'
import { sanitizeInspectionItems } from '../../../domain/dailyInspectionItems.ts'
import { fetchVehiclesDailyInspections, saveDailyInspection } from '../../../data/sync/dailyInspections.ts'
import { isOwnUnlinkedCar } from './memberRestoreRecords.ts'
import { SERVER_SAVE_FAIL } from '../../../shared/utils/failureMessages.ts'
import type { DailyInspection } from '../../../data/sync/dailyInspections.ts'
import type { JsonValue } from '../../../domain/jsonTypes.ts'

export type InspectionPick = DailyInspection & { vehicleId: string|number, workDate: string }

const INVALID_FILE = '파일 내용이 올바르지 않습니다.'
const FETCH_FAIL = '점검표를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
const SAVE_FAIL = SERVER_SAVE_FAIL

function readFileInspections(parsed: JsonValue): Record<string, Record<string, DailyInspection>>|null {
  if (!isPlainObject(parsed) || !('dailyInspections' in parsed)) return {}
  const byPlate = parsed.dailyInspections
  if (!isPlainObject(byPlate)) return null
  const out: Record<string, Record<string, DailyInspection>> = {}
  for (const [plate, byDate] of Object.entries(byPlate)) {
    if (!isPlainObject(byDate)) return null
    const days: Record<string, DailyInspection> = {}
    for (const [workDate, row] of Object.entries(byDate)) {
      if (!isValidCalendarDateKey(workDate) || !isPlainObject(row) || !isPlainObject(row.items)) return null
      if (typeof row.actionNote !== 'string' || typeof row.inspectorName !== 'string') return null
      days[workDate] = { items: sanitizeInspectionItems(row.items), actionNote: row.actionNote, inspectorName: row.inspectorName }
    }
    out[plate] = days
  }
  return out
}

function vehicleIdFor(ownerKey: string, plate: string): string|number|null {
  if (!isOwnUnlinkedCar(ownerKey, plate)) return null
  const cars = readOwnerCars(ownerKey)
  const car = plate === 'main'
    ? cars.find((item) => item.type === 'main')
    : cars.find((item) => String(item.number || '').trim() === plate)
  return car?.supabaseId ?? null
}

export async function pickInspections(ownerKey: string, parsed: JsonValue): Promise<{ ok: true, picks: InspectionPick[], skipped: number } | { ok: false, error: string }> {
  const fileInspections = readFileInspections(parsed)
  if (!fileInspections) return { ok: false, error: INVALID_FILE }
  const targets: Array<{ vehicleId: string|number, days: Record<string, DailyInspection> }> = []
  let skipped = 0
  for (const [plate, days] of Object.entries(fileInspections)) {
    if (Object.keys(days).length === 0) continue
    const vehicleId = vehicleIdFor(ownerKey, plate)
    if (vehicleId == null) skipped += 1
    else targets.push({ vehicleId, days })
  }
  if (targets.length === 0) return { ok: true, picks: [], skipped }
  let existing: Record<string, Record<string, DailyInspection>>
  try {
    existing = await fetchVehiclesDailyInspections(targets.map((target) => target.vehicleId))
  } catch (error) {
    console.error('[memberRestoreInspections] 점검표 확인 실패:', error)
    return { ok: false, error: FETCH_FAIL }
  }
  const picks: InspectionPick[] = []
  for (const { vehicleId, days } of targets) {
    const onServer = existing[String(vehicleId)] || {}
    for (const workDate of Object.keys(days).sort()) {
      if (!onServer[workDate]) picks.push({ vehicleId, workDate, ...days[workDate] })
    }
  }
  return { ok: true, picks, skipped }
}

export async function restoreInspections(picks: InspectionPick[]): Promise<{ ok: boolean, count: number, toast: string|null }> {
  let count = 0
  for (const pick of picks) {
    try {
      await saveDailyInspection(pick)
    } catch (error) {
      console.error('[memberRestoreInspections] 점검표 불러오기 실패:', error)
      return { ok: false, count, toast: SAVE_FAIL }
    }
    count += 1
  }
  return { ok: true, count, toast: null }
}
