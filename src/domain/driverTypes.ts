export type DriverRecord = {
  id: string
  name?: string
  phone?: string
  vehicleNumber?: string
  startDate?: string
  endDate?: string
  inviteCode?: string
  status?: 'pending' | 'linked'
  supabaseId?: number | string
  unlinkRequestedBy?: string
  unlinkRequestedAt?: string
}
