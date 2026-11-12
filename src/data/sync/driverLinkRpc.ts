import type { DriverLinkRow } from './syncTypes.ts'
import { supabase } from '../cloud/supabaseClient.ts'
import { assertCloudWriteReady } from '../cloud/cloudSession.ts'
import { normalizeInviteCode } from '../../domain/drivers.ts'

export async function upsertDriverLinkViaRpc({ idempotencyKey, vehicleId, inviteCode, assignmentStart, assignmentEnd }: { idempotencyKey: string, vehicleId: string, inviteCode: string,
  assignmentStart: string, assignmentEnd: string | null }): Promise<DriverLinkRow> {
  assertCloudWriteReady()
  const { data, error } = await supabase.rpc('upsert_driver_link_idempotent', {
    p_idempotency_key: idempotencyKey,
    p_vehicle_id: vehicleId,
    p_invite_code: inviteCode,
    p_assignment_start: assignmentStart,
    p_assignment_end: assignmentEnd || null,
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as DriverLinkRow | undefined
  if (!row) throw new Error('저장이 끝났는지 확인하지 못했습니다. 화면을 새로고침해서 확인해 주세요.')
  return row
}

export async function updateDriverLinkFields({ supabaseId, vehicleId, inviteCode, assignmentStart, assignmentEnd }: { supabaseId: number | string, vehicleId: string, inviteCode: string,
  assignmentStart: string, assignmentEnd: string | null }): Promise<DriverLinkRow> {
  assertCloudWriteReady()
  const { data, error } = await supabase
    .from('driver_links')
    .update({
      vehicle_id: vehicleId,
      invite_code: inviteCode,
      assignment_start: assignmentStart,
      assignment_end: assignmentEnd || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', supabaseId)
    .select()
    .single()
  if (error) throw error
  return (data) as DriverLinkRow
}

export function driverLinkRowNeedsUpdate(row: DriverLinkRow, { inviteCode, assignmentStart, assignmentEnd }: { inviteCode: string, assignmentStart: string, assignmentEnd: string | null }) {
  return (
    String(row.assignment_start ?? '') !== assignmentStart
    || String(row.assignment_end ?? '') !== (assignmentEnd ?? '')
    || (row.invite_code != null && row.invite_code !== inviteCode)
  )
}

export async function redeemDriverInviteCode(inviteCode: string): Promise<DriverLinkRow> {
  const { data: authData, error: authError } = await supabase.auth.getSession()
  if (authError || !authData?.session?.user) {
    throw new Error('로그인이 필요합니다.')
  }
  const { data, error } = await supabase.rpc('redeem_driver_invite_code', {
    p_invite_code: normalizeInviteCode(inviteCode),
  })
  if (error) throw new Error(error.message || '초대 코드 연동에 실패했습니다.')
  const row = (Array.isArray(data) ? data[0] : data) as DriverLinkRow | undefined
  if (!row) throw new Error('초대 코드가 맞지 않거나 기한(7일)이 지났습니다. 차주에게 새 코드를 요청해 주세요.')
  return row
}

export async function checkLinkedDriverLink(userId: string): Promise<{ ok: true, link: DriverLinkRow | null } | { ok: false }> {
  if (!userId) return { ok: true, link: null }
  const { data, error } = await supabase
    .from('driver_links')
    .select('*')
    .eq('driver_id', userId)
    .eq('status', 'linked')
    .maybeSingle()
  if (error) {
    console.warn('[driverLinkRpc] linked 조회 실패', error)
    return { ok: false }
  }
  return { ok: true, link: data ? (data) as DriverLinkRow : null }
}

export async function fetchLinkedDriverLink(userId: string): Promise<DriverLinkRow | null> {
  const result = await checkLinkedDriverLink(userId)
  return result.ok ? result.link : null
}

export async function fetchAssignedVehicleSummary(): Promise<Array<{ id: string, number?: string, type?: string, tonnage?: string, driver_pay_mode?: string | null, driver_salary_amount?: number | string | null, comm_enabled?: boolean | null, comm_type?: string | null, comm_value?: string | null, insurance_on?: boolean | null, driver_income_type?: string | null, withholding_on?: boolean | null, expense_rate?: string | null, insurance_rate?: string | null, driver_share_base?: string | null, insurance_split?: string | null, fuel_kind?: string | null }>> {
  const { data, error } = await supabase.rpc('get_assigned_vehicle_summary')
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function fetchLinkedOwnerBusinessInfo(ownerId: string): Promise<{ name?: string | null, business_name?: string | null, business_representative?: string | null, business_number?: string | null, business_address?: string | null, business_type?: string | null, business_item?: string | null, business_email?: string | null, bank_name?: string | null, account_number?: string | null, account_holder?: string | null } | null> {
  const { data, error } = await supabase.rpc('get_linked_owner_business_info', {
    p_owner_id: ownerId,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return row || null
}
