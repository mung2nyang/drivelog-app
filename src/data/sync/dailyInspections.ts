import type { JsonValue } from '../../domain/jsonTypes.ts'
import { supabase } from '../cloud/supabaseClient.ts'
import { sanitizeInspectionItems } from '../../domain/dailyInspectionItems.ts'
import { fetchAllRows } from '../cloud/fetchAllRows.ts'
import { assertSessionStillCurrent, blockedReasonForCloudWrite, captureSession, getCloudUserId } from '../cloud/cloudSession.ts'
import { notifyDailyInspectionChanged } from './dailyInspectionChanges.ts'
import type { InspectionItems } from '../../domain/dailyInspectionItems.ts'

export type DailyInspection = { items: InspectionItems, actionNote: string, inspectorName: string }

export const DELETE_FAIL = '일상점검표를 지우지 못했습니다.'

export async function fetchDailyInspection(vehicleId: string | number, workDate: string): Promise<DailyInspection | null> {
  const { data, error } = await supabase
    .from('daily_inspections')
    .select('items, action_note, inspector_name')
    .eq('vehicle_id', vehicleId)
    .eq('work_date', workDate)
    .maybeSingle()
  if (error) throw error
  if (!data || typeof data !== 'object') return null
  return toDailyInspection(data)
}

function toDailyInspection(row: { items?: JsonValue, action_note?: JsonValue, inspector_name?: JsonValue }): DailyInspection {
  return {
    items: sanitizeInspectionItems(row.items),
    actionNote: typeof row.action_note === 'string' ? row.action_note : '',
    inspectorName: typeof row.inspector_name === 'string' ? row.inspector_name : '',
  }
}

export async function saveDailyInspection({ vehicleId, workDate, items, actionNote, inspectorName }: { vehicleId: string | number, workDate: string, items: InspectionItems, actionNote: string, inspectorName: string }) {
  const userId = getCloudUserId()
  if (!userId) throw new Error('로그인 후 저장할 수 있습니다.')
  const blocked = blockedReasonForCloudWrite(String(vehicleId))
  if (blocked) throw new Error(blocked)
  const captured = captureSession()
  const { error } = await supabase.from('daily_inspections').upsert({
    user_id: userId,
    vehicle_id: vehicleId,
    work_date: workDate,
    items,
    action_note: actionNote.trim() || null,
    inspector_name: inspectorName,
  }, { onConflict: 'vehicle_id,work_date' })
  assertSessionStillCurrent(captured)
  if (error) throw error
  notifyDailyInspectionChanged({ vehicleId, workDate, saved: true })
}

export async function deleteDailyInspection({ vehicleId, workDate }: { vehicleId: string | number, workDate: string }) {
  if (!getCloudUserId()) throw new Error('로그인 후 지울 수 있습니다.')
  const blocked = blockedReasonForCloudWrite(String(vehicleId))
  if (blocked) throw new Error(blocked)
  const captured = captureSession()
  const { data, error } = await supabase.from('daily_inspections').delete().eq('vehicle_id', vehicleId).eq('work_date', workDate).select('id')
  assertSessionStillCurrent(captured)
  if (error) throw error
  if (!Array.isArray(data) || data.length === 0) throw new Error(DELETE_FAIL)
  notifyDailyInspectionChanged({ vehicleId, workDate, saved: false })
}

export async function fetchMonthDailyInspections(vehicleId: string | number, year: number, month: number): Promise<Record<string, DailyInspection>> {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const last = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('daily_inspections')
    .select('work_date, items, action_note, inspector_name')
    .eq('vehicle_id', vehicleId)
    .gte('work_date', first)
    .lte('work_date', last)
  if (error) throw error
  const byDate: Record<string, DailyInspection> = {}
  for (const row of Array.isArray(data) ? data : []) {
    if (row && typeof row.work_date === 'string') byDate[row.work_date] = toDailyInspection(row)
  }
  return byDate
}

export async function fetchVehiclesDailyInspections(vehicleIds: Array<string | number>): Promise<Record<string, Record<string, DailyInspection>>> {
  const byVehicle: Record<string, Record<string, DailyInspection>> = {}
  if (!vehicleIds.length) return byVehicle
  const { data, error } = await fetchAllRows(() => supabase
    .from('daily_inspections')
    .select('vehicle_id, work_date, items, action_note, inspector_name')
    .in('vehicle_id', vehicleIds)
    .order('id'))
  if (error) throw error
  for (const row of Array.isArray(data) ? data : []) {
    if (!row || row.vehicle_id == null || typeof row.work_date !== 'string') continue
    const key = String(row.vehicle_id)
    byVehicle[key] = { ...(byVehicle[key] || {}), [row.work_date]: toDailyInspection(row) }
  }
  return byVehicle
}

export async function hasAnyDailyInspection(vehicleId: string | number) {
  const { data, error } = await supabase.from('daily_inspections').select('id').eq('vehicle_id', vehicleId).limit(1)
  if (error) throw error
  return Array.isArray(data) && data.length > 0
}
