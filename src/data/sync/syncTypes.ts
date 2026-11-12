import type { DriverRecord } from '../../domain/driverTypes.ts'

export type OutboxResourceType = 'vehicle' | 'client' | 'driverLink'
export type OutboxKind = 'tombstone' | 'mutation'

export type OutboxPayload = {
  supabaseId?: number | string | null
  vehicleNumber?: string
  startDate?: string
  endDate?: string
  inviteCode?: string
  previousDriverSnapshot?: DriverRecord | null
  status?: 'pending' | 'linked'
}

export type OutboxOp = {
  id: string
  ownerKey: string
  userId: string
  resourceType: OutboxResourceType
  resourceId: string
  kind: OutboxKind
  operation: string
  payload: OutboxPayload
  sessionEpoch: number
  createdAt: string
}

export type SessionCapture = { userId: string | null, ownerKey: string | null, epoch: number }

export type CarRecord = {
  id: string
  number?: string
  type?: 'main' | 'sub'
  supabaseId?: number | string
}

export type DriverLinkRow = {
  id: number | string
  owner_id?: string
  driver_id?: string | null
  vehicle_id?: string | null
  invite_code?: string
  assignment_start?: string | null
  assignment_end?: string | null
  status?: 'pending' | 'linked' | 'disconnected'
}

export type AppSession = {
  userId?: string | null
  name?: string
  phone?: string
  accountType?: string
  linkedOwnerId?: string | null
  guestMode?: boolean
}
