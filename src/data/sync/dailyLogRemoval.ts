import { supabase } from '../cloud/supabaseClient.ts'
import { dayLogVersion, setDayLogVersion } from './dayLogVersions.ts'

export async function removeDayLogOnServer(vehicleId: number | string, workDate: string) {
  const { data, error } = await supabase.rpc('remove_day_log', {
    p_vehicle_id: vehicleId,
    p_work_date: workDate,
    p_expected_updated_at: dayLogVersion(vehicleId, workDate),
  })
  if (error) throw error
  setDayLogVersion(vehicleId, workDate, data)
}
