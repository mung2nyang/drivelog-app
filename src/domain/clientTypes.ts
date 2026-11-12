export type ClientLike = {
  id: string
  companyName: string
  managerName?: string
  phone?: string
  bizNumber?: string
  paymentTerm?: string
  paymentTermValue?: string
  isPinned?: boolean
  taxInvoiceEnabled?: boolean
  scopedToVehicleNumber?: string
  commEnabled?: boolean
  commType?: string
  commValue?: string | number
  fixedRouteLinked?: boolean
  palletOn?: boolean
  palletPrice?: string | number
  fixedUnitPrice?: string | number
  taxRepresentative?: string
  taxEmail?: string
  taxAddress?: string
  taxBizType?: string
  taxBizItem?: string
  supabaseId?: string | number
}

export type ClientDraft = {
  companyName?: string
  managerName?: string
  phone?: string
  bizNumber?: string
  paymentTerm?: string
  paymentTermValue?: string | number
  taxRepresentative?: string
  taxEmail?: string
  taxAddress?: string
  taxBizType?: string
  taxBizItem?: string
  isPinned?: boolean
  scopedToVehicleNumber?: string
  commEnabled?: boolean
  commType?: string
  commValue?: string | number
  fixedRouteLinked?: boolean
  fixedUnitPrice?: string | number
  palletOn?: boolean
  palletPrice?: string | number
  id?: string
  supabaseId?: string
}
