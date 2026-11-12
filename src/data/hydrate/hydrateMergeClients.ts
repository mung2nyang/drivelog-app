import { COMM_TYPES, PAYMENT_TERM_VALUES, isAllowedEnum } from '../store/persistDomainEnums.ts'
import { isStringOrFiniteNumber } from '../store/persistDomainRecords.ts'
import type { ClientRow, LocalClient, RawClientBackup } from './hydrateMergeTypes.ts'

function stringOrEmpty(value: string | undefined) {
  return typeof value === 'string' ? value : ''
}

function boolOrFalse(value: boolean | undefined) {
  return typeof value === 'boolean' ? value : false
}

function numericOrEmpty(value: string | number | undefined) {
  return value !== undefined && isStringOrFiniteNumber(value) ? value : ''
}

export function mergeClientsFromRows(localClients: Array<LocalClient>, clientRows: Array<ClientRow> | null | undefined) {
  if (!Array.isArray(clientRows)) return Array.isArray(localClients) ? localClients : []
  const clients = clientRows.map((row) => {
    const raw = row.raw && typeof row.raw === 'object' ? row.raw : ({}) as RawClientBackup
    const client: LocalClient = {
      id: row.legacy_client_id || String(row.id),
      companyName: row.company_name || '',
      supabaseId: row.id,
      isPinned: row.is_pinned ?? boolOrFalse(raw.isPinned),
      managerName: stringOrEmpty(raw.managerName),
      phone: stringOrEmpty(raw.phone),
      bizNumber: stringOrEmpty(raw.bizNumber),
      scopedToVehicleNumber: stringOrEmpty(raw.scopedToVehicleNumber),
      commEnabled: boolOrFalse(raw.commEnabled),
      commType: typeof raw.commType === 'string' && isAllowedEnum(raw.commType, COMM_TYPES) ? raw.commType : 'percent',
      commValue: numericOrEmpty(raw.commValue),
      fixedRouteLinked: boolOrFalse(raw.fixedRouteLinked),
      palletOn: boolOrFalse(raw.palletOn),
      palletPrice: numericOrEmpty(raw.palletPrice),
      fixedUnitPrice: numericOrEmpty(raw.fixedUnitPrice),
      paymentTermValue: stringOrEmpty(raw.paymentTermValue),
      taxRepresentative: stringOrEmpty(raw.taxRepresentative),
      taxEmail: stringOrEmpty(raw.taxEmail),
      taxAddress: stringOrEmpty(raw.taxAddress),
      taxBizType: stringOrEmpty(raw.taxBizType),
      taxBizItem: stringOrEmpty(raw.taxBizItem),
    }
    if (typeof raw.paymentTerm === 'string' && isAllowedEnum(raw.paymentTerm, PAYMENT_TERM_VALUES)) {
      client.paymentTerm = raw.paymentTerm
    }
    return client
  })
  const unsynced = (localClients || []).filter((client) => client && !client.supabaseId)
  return [...clients, ...unsynced]
}
