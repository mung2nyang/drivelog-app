import type { ClientDraft, ClientLike } from './clientTypes.ts'

export function clientToDraft(client: ClientLike): ClientDraft {
  return {
    companyName: client.companyName || '',
    managerName: client.managerName || '',
    phone: client.phone || '',
    bizNumber: client.bizNumber || '',
    taxRepresentative: client.taxRepresentative || '',
    taxEmail: client.taxEmail || '',
    taxAddress: client.taxAddress || '',
    taxBizType: client.taxBizType || '',
    taxBizItem: client.taxBizItem || '',
    paymentTerm: client.paymentTerm || 'next_month_end',
    paymentTermValue: client.paymentTermValue || '',
    isPinned: !!client.isPinned,
    commEnabled: !!client.commEnabled,
    commType: client.commType === 'direct' ? 'direct' : 'percent',
    commValue: String(client.commValue ?? ''),
    fixedRouteLinked: !!client.fixedRouteLinked,
    fixedUnitPrice: String(client.fixedUnitPrice ?? ''),
    palletOn: !!client.palletOn,
    palletPrice: String(client.palletPrice ?? ''),
    ...(client.scopedToVehicleNumber ? { scopedToVehicleNumber: client.scopedToVehicleNumber } : {}),
  }
}

export function fixedRouteCandidates(clients: Array<ClientLike>, scopeKey: string) {
  const key = String(scopeKey || '').trim()
  return clients.filter((client) => (key ? client.scopedToVehicleNumber === key : !client.scopedToVehicleNumber))
}
