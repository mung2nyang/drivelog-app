import { getTaxInvoiceSourceGroups } from './financeTaxInvoiceGroups.ts'
import type { FinanceSettings, SupplierBiz, WorkDataByLogId } from './financeTypes.ts'

export type TaxInvoiceGroup = {
  partyKey?: string
  clientName?: string
  partyType?: string
  carNumber?: string
  count?: number
  supplyAmount?: number
  taxAmount?: number
  totalAmount?: number
  supplierBiz?: SupplierBiz
  vehicleLabel?: string
  vehicleNumbers?: Array<string>
}

export type TaxInvoiceRecord = {
  id?: string
  flow?: string
  monthKey?: string
  status?: string
  partyKey?: string
}

export type InvoiceLike = TaxInvoiceRecord & { id: string, supabaseId?: string | number, supplyAmount?: number,
  taxAmount?: number, totalAmount?: number, count?: number, carNumber?: string, logId?: string,
  vehicleNumbers?: Array<string>, vehicleLabel?: string, clientName?: string, clientBizNumber?: string,
  clientRepresentative?: string, clientAddress?: string, clientBizType?: string, clientBizItem?: string,
  clientEmail?: string, issueDate?: string, itemName?: string, remark?: string, updatedAt?: string,
  issuedAt?: string, partyKey?: string, partyType?: string, supplierKey?: string,
  supplierBiz?: SupplierBiz }

export function getTaxInvoiceFlowMeta() {
  return { label: '매출 발행', partyHeading: '공급받는 자', itemName: '화물운송료', completeLabel: '발급 완료' }
}

export function getTaxInvoiceRecordId(monthKey: string, partyKey?: string, flow = 'sales') {
  return `${flow}|${monthKey}|${partyKey}`
}

export function getTaxInvoicePartyInfo(group: TaxInvoiceGroup, settings: FinanceSettings = {}) {
  const client = (settings.clients || []).find((item) => item.companyName === group.clientName)
  return {
    clientBizNumber: client?.bizNumber || '',
    clientRepresentative: client?.taxRepresentative || client?.managerName || '',
    clientAddress: client?.taxAddress || '',
    clientBizType: client?.taxBizType || '',
    clientBizItem: client?.taxBizItem || '',
    clientEmail: client?.taxEmail || '',
  }
}

export function buildTaxInvoiceEntry(group: TaxInvoiceGroup, monthKey: string, flow: 'sales' = 'sales', records: Array<TaxInvoiceRecord> = [], settings: FinanceSettings = {}) {
  const id = getTaxInvoiceRecordId(monthKey, group.partyKey, flow)
  const saved = (records || []).find((item) => item.id === id) || {}
  const meta = getTaxInvoiceFlowMeta()
  return {
    ...getTaxInvoicePartyInfo(group, settings),
    itemName: meta.itemName,
    remark: `${parseInt(monthKey.slice(5, 7), 10)}월 ${meta.itemName}`,
    ...saved,
    ...group,
    id,
    flow,
    logId: group.carNumber || 'fleet',
    monthKey,
    status: saved.status || 'draft',
  }
}

export function getTaxInvoiceSupplierBiz(item?: { flow?: string, supplierBiz?: SupplierBiz }, settings: FinanceSettings = {}) {
  if (item?.flow === 'sales' && item.supplierBiz) return item.supplierBiz
  return {
    name: settings.bizName || '',
    bizNumber: settings.bizNumber || '',
    representative: settings.bizRepresentative || settings.userName || '',
    address: settings.bizAddress || '',
    bizType: settings.bizType || '',
    bizItem: settings.bizItem || '',
    email: settings.bizEmail || '',
  }
}

export function listTaxInvoiceEntries(monthKey: string, flow: 'sales', settings: FinanceSettings, workDataByLogId: WorkDataByLogId, records: Array<TaxInvoiceRecord> = [], logKey?: string) {
  const sourceEntries = getTaxInvoiceSourceGroups(monthKey, flow, settings, workDataByLogId, logKey)
    .map((group) => buildTaxInvoiceEntry(group, monthKey, flow, records, settings))
  const storedIssued = (records || []).filter((item) => item.flow === flow && item.monthKey === monthKey && item.status === 'issued'
    && (!logKey || String(item.partyKey || '').endsWith(`__${logKey}`)))
  const issuedById = new Map(storedIssued.map((item) => [item.id, item]))
  sourceEntries.forEach((item) => {
    if (item.status === 'issued') issuedById.set(item.id, item)
  })
  const issuedEntries = [...issuedById.values()]
  const draftEntries = sourceEntries.filter((item) => item.status !== 'issued')
  return { sourceEntries, draftEntries, issuedEntries }
}
