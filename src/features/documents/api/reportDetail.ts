import { getCallDetails, isOffDay } from '../../../domain/day-record.ts'
import { getCallDetailCommissionAmount, resolveCallDetailCommission } from '../../../domain/financeCore.ts'
import { parseCurrencyValue, vatOf } from '../../../domain/money.ts'
import type { CallDetailLike } from '../../../domain/callDetail.ts'
import type { ClientLike } from '../../../domain/clientTypes.ts'
import type { DayRecordLike } from '../../../domain/dayRecordTypes.ts'

export function detailReportClientOptions(workData: Record<string, DayRecordLike>|null|undefined, year: number, monthIndex: number, clients: Array<ClientLike>|null|undefined): Array<string> {
  const clientSet: Set<string> = new Set()
  ;(clients || []).forEach((client) => {
    const name = String(client?.companyName || '').trim()
    if (name) clientSet.add(name)
  })
  const lastDate = new Date(year, monthIndex + 1, 0).getDate()
  for (let day = 1; day <= lastDate; day += 1) {
    const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const record = workData?.[dateKey]
    if (!record || isOffDay(record)) continue
    getCallDetails(record).forEach((detail: CallDetailLike) => {
      const name = String(detail?.client || '').trim()
      if (name) clientSet.add(name)
    })
  }
  clientSet.add('미지정')
  return ['ALL', ...clientSet]
}

function detailCommissionLabel(detail: CallDetailLike|null|undefined, settings: { clients?: Array<ClientLike> }): string|null {
  const { enabled, type, value } = resolveCallDetailCommission(detail, settings)
  if (!enabled) return null
  if (type === 'direct') return `${parseCurrencyValue(value).toLocaleString('ko-KR')}원`
  return `${value}%`
}

export function buildDetailReport(workData: Record<string, DayRecordLike>|null|undefined, year: number, monthIndex: number, clientFilter: string, settings: { clients?: Array<ClientLike> } = {}) {
  const items: Array<{ dateStr: string, loadLoc: string, unloadLoc: string, client: string, fare: number }> = []
  let totalFare = 0
  let totalCommission = 0
  let defaultBaseFare = 0
  let vat = 0
  const monthFareByClient: Record<string, number> = {}
  const monthCommByClient: Record<string, number> = {}
  const clientCommLabels: Record<string, string> = {}
  const lastDate = new Date(year, monthIndex + 1, 0).getDate()

  for (let day = 1; day <= lastDate; day += 1) {
    const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const record = workData?.[dateKey]
    if (!record || isOffDay(record)) continue
    getCallDetails(record).forEach((detail: CallDetailLike) => {
      const clientName = detail?.client || '미지정'
      if (clientFilter !== 'ALL' && clientFilter !== clientName) return
      const fare = parseCurrencyValue(detail?.fare)
      const registered = !!(detail?.client && (settings.clients || []).some((c) => c.companyName === detail.client))
      let commission = 0
      if (detail?.client) {
        commission = getCallDetailCommissionAmount(detail, fare, settings)
        if (commission > 0) {
          monthCommByClient[clientName] = (monthCommByClient[clientName] || 0) + commission
          const label = detailCommissionLabel(detail, settings)
          if (label) clientCommLabels[clientName] = label
        }
      }
      if (registered) monthFareByClient[clientName] = (monthFareByClient[clientName] || 0) + fare
      else defaultBaseFare += fare
      items.push({
        dateStr: `${monthIndex + 1}월 ${day}일`,
        loadLoc: detail?.loadLoc || '-',
        unloadLoc: detail?.unloadLoc || '-',
        client: clientName,
        fare,
      })
      totalFare += fare
      if (!detail?.vatExempt) vat += vatOf(fare)
      totalCommission += commission
    })
  }

  return {
    items,
    totalFare,
    totalCommission,
    defaultBaseFare,
    monthFareByClient,
    monthCommByClient,
    clientCommLabels,
    vat,
    grandTotal: totalFare - totalCommission + vat,
  }
}
