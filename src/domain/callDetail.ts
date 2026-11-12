export type PaymentLike = {
  id?: string
  amount?: string | number
  paidAt?: string
  note?: string
}

export type CallDetailLike = {
  id?: string
  loadLoc?: string
  unloadLoc?: string
  fare?: string | number
  client?: string
  clientId?: string | null
  commissionSnapshot?: { enabled: boolean, type: string | null, value: string | number | null }
  remarks?: string
  vatExempt?: boolean
  paymentStatus?: string
  payments?: Array<PaymentLike>
  paymentDueDate?: string
  workDate?: string
  distanceType?: string
  linkedLoadIndex?: string
  departureTime?: string
  arrivalTime?: string
  platform?: string
  cargoTonnage?: string | number
  receipt?: string
  startOdometer?: string
  endOdometer?: string
  distanceKm?: string
  insuranceFee?: string | number
}
