import { getReceivableItems } from '../../../domain/finance.ts'
import type { ReceivableItemLike } from '../../../domain/financeReceivables.ts'
import type { JsonValue } from '../../../domain/jsonTypes.ts'
import { groupByClientMonth } from '../../../domain/receivables.ts'
import { buildFinanceSettings } from '../../../data/sync/ownerFinance.ts'
import { fillMessageTemplatePattern, getMessageTemplatePatterns } from '../../../data/sync/messageTemplates.ts'
import { readOwnerClients, readOwnerSettings, readOwnerWorkDataByLogId } from '../../../data/store/ownerDataHooks.ts'

export type UnbiseoSms = { client: string, month: string, all: boolean, template: 1 | 2 | 3 | null }
export type SmsPick = { kind: 'month', month: string } | { kind: 'all' } | { kind: 'items', keys: Array<string> }
export type SmsTotal = { client: string, count: number, total: number }

const CLIENT_MAX = 50
const TEMPLATES: Array<1 | 2 | 3> = [1, 2, 3]

export function readSms(row: { [key: string]: JsonValue }): UnbiseoSms {
  const client = typeof row.client === 'string' ? row.client.trim() : ''
  const month = typeof row.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) ? row.month : ''
  return {
    client: client.length <= CLIENT_MAX ? client : '',
    month,
    all: !month && row.all === true,
    template: TEMPLATES.find((number) => number === row.template) ?? null,
  }
}

export function readSmsItems(ownerKey: string): Array<ReceivableItemLike> {
  return getReceivableItems(buildFinanceSettings(ownerKey), readOwnerWorkDataByLogId(ownerKey))
}

export function itemKey(item: ReceivableItemLike): string {
  return `${item.logId}|${item.dateKey}|${item.detailId}`
}

function sumOf(items: Array<ReceivableItemLike>): number {
  return items.reduce((sum, item) => sum + item.remainingAmount, 0)
}

export function smsClientTotals(items: Array<ReceivableItemLike>): Array<SmsTotal> {
  const byClient = new Map<string, Array<ReceivableItemLike>>()
  items.forEach((item) => byClient.set(item.client, [...(byClient.get(item.client) || []), item]))
  return [...byClient.entries()]
    .map(([client, list]) => ({ client, count: list.length, total: sumOf(list) }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
}

export function smsClientItems(items: Array<ReceivableItemLike>, client: string) {
  const list = items.filter((item) => item.client === client).sort((a, b) => String(a.workDate).localeCompare(String(b.workDate)))
  return { list, months: groupByClientMonth(list) }
}

export function pickedItems(list: Array<ReceivableItemLike>, pick: SmsPick): Array<ReceivableItemLike> {
  if (pick.kind === 'all') return list
  if (pick.kind === 'month') return list.filter((item) => String(item.workDate).slice(0, 7) === pick.month)
  return list.filter((item) => pick.keys.includes(itemKey(item)))
}

export function monthLabel(month: string, today: string): string {
  const name = `${Number(month.slice(5, 7))}월분`
  return month.slice(0, 4) === today.slice(0, 4) ? name : `${month.slice(0, 4)}년 ${name}`
}

export function itemLabel(item: ReceivableItemLike): string {
  const date = `${Number(String(item.workDate).slice(5, 7))}월 ${Number(String(item.workDate).slice(8, 10))}일`
  return `${date} ${item.loadLoc || '상차지'} → ${item.unloadLoc || '하차지'}`
}

export function smsRouteLabel(pick: SmsPick, picked: Array<ReceivableItemLike>, today: string): string {
  if (pick.kind === 'month') return `${monthLabel(pick.month, today)} ${picked.length}건`
  if (pick.kind === 'all') return `전체 ${picked.length}건`
  const first = picked[0] ? itemLabel(picked[0]) : ''
  return picked.length > 1 ? `${first} 외 ${picked.length - 1}건` : first
}

export function smsBody(ownerKey: string, template: 1 | 2 | 3, client: string, pick: SmsPick, picked: Array<ReceivableItemLike>, today: string): string {
  const pattern = getMessageTemplatePatterns(readOwnerSettings(ownerKey))[template - 1]
  return fillMessageTemplatePattern(pattern, { company: client, route: smsRouteLabel(pick, picked, today), fare: sumOf(picked).toLocaleString('ko-KR') })
}

export function smsTotal(picked: Array<ReceivableItemLike>): number {
  return sumOf(picked)
}

export function smsPhone(ownerKey: string, client: string): string {
  return readOwnerClients(ownerKey).find((item) => (item.companyName || '').trim() === client && item.phone)?.phone || ''
}
