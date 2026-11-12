import * as v from 'valibot'
import { bool, finiteNumber, opt, plain, str, stringOrNumber } from '../../domain/schemaParts.ts'
import { INVOICE_FLOWS, INVOICE_STATUSES, PARTY_TYPES } from './persistDomainEnums.ts'
import type { JsonValue } from '../../domain/jsonTypes.ts'
import type { InvoiceLike } from '../../domain/financeTaxInvoiceEntries.ts'

const SUPPLIER_BIZ = plain(v.strictObject({
  sameAsOwner: opt(bool), name: opt(str), bizNumber: opt(str), representative: opt(str),
  address: opt(str), bizType: opt(str), bizItem: opt(str), email: opt(str),
}))

const INVOICE = plain(v.strictObject({
  id: str,
  supabaseId: opt(stringOrNumber),
  flow: opt(v.picklist(INVOICE_FLOWS)), status: opt(v.picklist(INVOICE_STATUSES)), partyType: opt(v.picklist(PARTY_TYPES)),
  monthKey: opt(str), carNumber: opt(str), vehicleLabel: opt(str), clientName: opt(str), clientBizNumber: opt(str),
  clientRepresentative: opt(str), clientAddress: opt(str), clientBizType: opt(str), clientBizItem: opt(str), clientEmail: opt(str),
  issueDate: opt(str), itemName: opt(str), remark: opt(str), updatedAt: opt(str), issuedAt: opt(str),
  partyKey: opt(str), logId: opt(str), supplierKey: opt(str),
  supplyAmount: opt(finiteNumber), taxAmount: opt(finiteNumber), totalAmount: opt(finiteNumber), count: opt(finiteNumber),
  vehicleNumbers: opt(v.array(str)),
  supplierBiz: opt(SUPPLIER_BIZ),
  grossAmount: opt(finiteNumber), commissionAmount: opt(finiteNumber), insuranceAmount: opt(finiteNumber), netAmount: opt(finiteNumber),
}))

export function isPersistedInvoice(value: JsonValue): value is InvoiceLike {
  return v.is(INVOICE, value)
}
