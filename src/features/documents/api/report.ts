import type { ClientLike } from '../../../domain/clientTypes.ts'
import type { JsonValue } from '../../../domain/jsonTypes.ts'
export function dash(value: JsonValue|undefined) {
  const text = String(value || '').trim()
  return text || '-'
}

export function buildReportFileName(year: number, monthIndex: number) {
  return `${year}년_${monthIndex + 1}월_운송비내역서.pdf`
}

export function buildDetailReportFileName(year: number, monthIndex: number, clientFilter: string) {
  const suffix = clientFilter === 'ALL' ? '전체' : clientFilter
  return `${year}년_${monthIndex + 1}월_운송비내역서(세부)_${suffix}.pdf`
}

export function reportBaseFileName(viewMode: 'summary'|'detail', year: number, monthIndex: number, clientFilter: string) {
  return (viewMode === 'detail'
    ? buildDetailReportFileName(year, monthIndex, clientFilter)
    : buildReportFileName(year, monthIndex)).replace(/\.pdf$/, '')
}

export function getReportShareCompanyName(viewMode: 'summary'|'detail', clientFilter: string): string {
  return viewMode === 'detail' && clientFilter !== 'ALL' ? clientFilter : '거래처'
}

export function getDetailReportClientContact(viewMode: 'summary'|'detail', clientFilter: string, clients: Array<ClientLike>|null|undefined): { name: string, phone: string } | null {
  if (viewMode !== 'detail' || clientFilter === 'ALL') return null
  const client = (clients || []).find((item) => item.companyName === clientFilter)
  return client?.phone ? { name: client.companyName, phone: client.phone } : null
}
