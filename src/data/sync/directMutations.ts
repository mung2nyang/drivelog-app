import type { SessionCapture } from './syncTypes.ts'
import { supabase } from '../cloud/supabaseClient.ts'
import { assertCloudWriteReady, assertSessionStillCurrent } from '../cloud/cloudSession.ts'

export async function deleteVehicleFromSupabase(vehicleSupabaseId: number | string | null | undefined, captured: SessionCapture) {
  if (!vehicleSupabaseId) return
  assertCloudWriteReady()
  const { data, error } = await supabase.from('vehicles').delete().eq('id', vehicleSupabaseId).select('id')
  assertSessionStillCurrent(captured)
  if (error) throw error
  if (Array.isArray(data) && data.length === 0) {
    throw new Error('이미 삭제됐거나 찾을 수 없습니다. 화면을 새로고침해 주세요.')
  }
}

export async function deleteClientFromSupabase(clientSupabaseId: number | string | null | undefined, captured: SessionCapture) {
  if (!clientSupabaseId) return
  assertCloudWriteReady()
  const unlinkResults = await Promise.all([
    supabase.from('transport_details').update({ client_id: null }).eq('client_id', clientSupabaseId),
    supabase.from('tax_invoices').update({ client_id: null }).eq('client_id', clientSupabaseId),
  ])
  assertSessionStillCurrent(captured)
  const unlinkError = unlinkResults.find((result) => result.error)?.error
  if (unlinkError) throw unlinkError
  const { data, error } = await supabase.from('clients').delete().eq('id', clientSupabaseId).select('id')
  assertSessionStillCurrent(captured)
  if (error) throw error
  if (Array.isArray(data) && data.length === 0) {
    throw new Error('이미 삭제됐거나 찾을 수 없습니다. 화면을 새로고침해 주세요.')
  }
}

export async function updateDriverLinkStatusOnSupabase(supabaseId: number | string | null | undefined, status: 'pending' | 'linked', captured: SessionCapture) {
  if (!supabaseId) return
  assertCloudWriteReady()
  const { error } = await supabase.from('driver_links').update({ status, updated_at: new Date().toISOString() }).eq('id', supabaseId)
  assertSessionStillCurrent(captured)
  if (error) throw error
}

export async function deleteDriverLinkOnSupabase(supabaseId: number | string | null | undefined, captured: SessionCapture) {
  if (!supabaseId) return
  assertCloudWriteReady()
  const { data, error } = await supabase.from('driver_links').delete().eq('id', supabaseId).select('id')
  assertSessionStillCurrent(captured)
  if (error) throw error
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('이미 삭제됐거나 찾을 수 없습니다. 화면을 새로고침해 주세요.')
  }
}
