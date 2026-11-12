import { supabase } from '../cloud/supabaseClient.ts'

export async function removeDayLogOnServer(vehicleId: number | string, workDate: string) {
  const { error } = await supabase.rpc('remove_day_log', { p_vehicle_id: vehicleId, p_work_date: workDate })
  if (error) throw error
}
