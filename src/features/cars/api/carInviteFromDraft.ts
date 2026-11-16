import { normalizeInviteCode, upsertDriver } from '../../../domain/drivers.ts'
import { requestDriverInviteSave } from '../../../data/sync/requestDriverInviteSave.ts'
import type { CarRecord } from '../../../data/sync/syncTypes.ts'
import type { DriverRecord } from '../../../domain/driverTypes.ts'
import type { CarLike } from '../../../domain/financeTypes.ts'

export type CarInviteDraft = {
  type: 'main'|'sub'
  number: string
  driverName: string
  driverPhone: string
  inviteCode?: string
  inviteStartDate?: string
  inviteDriverId?: string|null
}

export function todayIsoDate(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

type SaveInviteAfterVehicleProps = {
  cloud: boolean
  ownerKey: string
  userId: string
  drivers: Array<DriverRecord>
  cars: Array<CarLike>
  saved: CarLike|null|undefined
  inviteDraft: CarInviteDraft
  skipInvite?: boolean
}

export async function saveInviteAfterVehicle({
  cloud, ownerKey, userId, drivers, cars, saved, inviteDraft, skipInvite = false,
}: SaveInviteAfterVehicleProps): Promise<{ toast: string|null, saved: boolean }> {
  if (!cloud || inviteDraft.type !== 'sub' || skipInvite) return { toast: null, saved: false }
  const code = normalizeInviteCode(inviteDraft.inviteCode)
  if (!code) return { toast: null, saved: false }
  const vehicleNumber = saved?.number || inviteDraft.number
  if (!vehicleNumber) return { toast: null, saved: false }
  const startDate = inviteDraft.inviteStartDate || todayIsoDate()
  const existing = inviteDraft.inviteDriverId ? drivers.find((d) => d.id === inviteDraft.inviteDriverId) : null
  const result = upsertDriver(
    drivers,
    {
      name: inviteDraft.driverName,
      phone: inviteDraft.driverPhone,
      inviteCode: code,
      vehicleNumber,
      startDate,
      endDate: existing?.endDate || '',
    },
    (inviteDraft.inviteDriverId || null) as null|undefined,
    cars,
  )
  if (result.error) return { toast: result.error, saved: false }
  let carsForInvite: Array<CarLike> = cars
  if (saved?.id) {
    const idx = cars.findIndex((c) => c.id === saved.id)
    if (idx >= 0) {
      carsForInvite = cars.slice()
      carsForInvite[idx] = { ...cars[idx], ...saved }
    } else {
      carsForInvite = [...cars, saved]
    }
  }
  const saveResult = await requestDriverInviteSave({
    ownerKey,
    userId,
    items: result.items,
    editingId: inviteDraft.inviteDriverId ?? null,
    cars: carsForInvite as Array<CarRecord>,
    previousItems: drivers,
  })
  if (saveResult.blocked) return { toast: saveResult.blocked, saved: false }
  return { toast: saveResult.toast || null, saved: saveResult.saved }
}