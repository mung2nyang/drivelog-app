import type { SessionCapture } from './syncTypes.ts'
import type { DailyLogRow, DetailRow } from '../hydrate/hydrateMergeTypes.ts'
import { supabase } from '../cloud/supabaseClient.ts'
import { isSessionStillCurrent } from '../cloud/cloudSession.ts'
import { commitLogWorkData } from '../store/commitHelpers.ts'
import { readOwnerLogWorkData } from '../store/ownerWorkDataHooks.ts'
import { mergeWorkDataFromRows } from '../hydrate/hydrateMerge.ts'
import { setDayLogVersion } from './dayLogVersions.ts'

export async function reloadDayLogFromServer(ownerKey: string, logId: string, vehicleId: number | string, dateKey: string, captured: SessionCapture): Promise<boolean> {
  try {
    const [daily, transport] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('vehicle_id', vehicleId).eq('work_date', dateKey),
      supabase.from('transport_details').select('*').eq('vehicle_id', vehicleId).eq('work_date', dateKey).order('sequence', { ascending: true }).order('id'),
    ])
    if (daily.error || transport.error || !isSessionStillCurrent(captured)) return false
    const dailyRows = (Array.isArray(daily.data) ? daily.data : []) as Array<DailyLogRow>
    const transportRows = (Array.isArray(transport.data) ? transport.data : []) as Array<DetailRow>
    const merged = mergeWorkDataFromRows({}, { dailyRows, transportRows })
    const latest = { ...readOwnerLogWorkData(ownerKey, logId) }
    if (merged[dateKey]) latest[dateKey] = merged[dateKey]
    else delete latest[dateKey]
    commitLogWorkData(ownerKey, logId, latest)
    setDayLogVersion(vehicleId, dateKey, dailyRows.find((row) => row.work_date === dateKey)?.updated_at)
    return true
  } catch (error) {
    console.error('[reloadDayLogFromServer] 그날 일지 다시 읽기 실패:', error)
    return false
  }
}
