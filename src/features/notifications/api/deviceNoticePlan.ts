import type { JsonValue } from '../../../domain/jsonTypes.ts'
import type { ReceivableItemLike } from '../../../domain/financeReceivables.ts'
import type { WorkDataByLogId } from '../../../domain/financeTypes.ts'
import type { AppSession } from '../../../data/sync/syncTypes.ts'
import { formatWon } from '../../../domain/money.ts'
import { getDdayLabel } from '../../../domain/receivables.ts'
import { getReceivableItems } from '../../../domain/finance.ts'
import { buildFinanceSettings, loadWorkDataByLogId } from '../../../data/sync/ownerFinance.ts'
import { readOwnerSettings } from '../../../data/store/ownerDataHooks.ts'
import { getLastBackupAt } from '../../../data/sync/guestBackup.ts'
import { isCloudSession } from '../../../data/cloud/cloudSession.ts'
import { readDismissedIds } from './dismissNotice.ts'

export type DeviceNotice = { key: string, page: string, title: string, body: string, at: Date }

export type DeviceNoticeInput = {
  now: Date
  workDataByLogId: WorkDataByLogId
  receivables: Array<ReceivableItemLike>
  dismissed: Array<string>
  off: Array<string>
  guest: boolean
  lastBackupAt: string | null
}

const TODAY_HOUR = 18
const TODAY_DAYS_AHEAD = 7
const OVERDUE_HOUR = 9
const OVERDUE_MAX = 20
const BACKUP_HOUR = 20
const BACKUP_AFTER_DAYS = 14
const NEVER_BACKUP_AFTER_DAYS = 3

function dateKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayAt(base: Date, days: number, hour: number) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, hour, 0, 0, 0)
}

function hasDayEntry(value: JsonValue | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const callDetails = value.callDetails
  return !!value.isOff
    || (Array.isArray(callDetails) && callDetails.length > 0)
    || (parseInt(String(value.fixedCount ?? ''), 10) || 0) > 0
    || (parseInt(String(value.palletCount ?? ''), 10) || 0) > 0
}

function todayNotices(input: DeviceNoticeInput): Array<DeviceNotice> {
  const mainLog: Record<string, JsonValue | undefined> = input.workDataByLogId.main || {}
  const notices: Array<DeviceNotice> = []
  for (let days = 0; days <= TODAY_DAYS_AHEAD; days += 1) {
    const at = dayAt(input.now, days, TODAY_HOUR)
    const dateKey = dateKeyOf(at)
    if (at <= input.now || hasDayEntry(mainLog[dateKey]) || input.dismissed.includes(`today:${dateKey}`)) continue
    notices.push({
      key: `today:${dateKey}`,
      page: 'home',
      title: '오늘 작성한 운행일지가 없습니다',
      body: '홈에서 [운행 기록하기]를 눌러 운행 기록을 추가하거나 휴무를 등록해 주세요.',
      at,
    })
  }
  return notices
}

function overdueNotices(input: DeviceNoticeInput): Array<DeviceNotice> {
  const notices: Array<DeviceNotice> = []
  input.receivables.forEach((item) => {
    const due = new Date(`${item.paymentDueDate}T00:00:00`)
    if (Number.isNaN(due.getTime())) return
    const at = dayAt(due, 1, OVERDUE_HOUR)
    const key = `overdue:${item.logId}:${item.dateKey}:${item.detailId}`
    if (at <= input.now || input.dismissed.includes(key)) return
    notices.push({
      key,
      page: 'receivables',
      title: `${item.client} 연체 미수금`,
      body: `${formatWon(item.remainingAmount)}, ${getDdayLabel(item.paymentDueDate, at)}`,
      at,
    })
  })
  return notices.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, OVERDUE_MAX)
}

function backupNotices(input: DeviceNoticeInput): Array<DeviceNotice> {
  if (!input.guest) return []
  const lastTime = input.lastBackupAt ? new Date(input.lastBackupAt).getTime() : NaN
  const hasBackup = !Number.isNaN(lastTime)
  const key = `backup:${hasBackup ? lastTime : 'never'}`
  const at = hasBackup
    ? dayAt(new Date(lastTime), BACKUP_AFTER_DAYS, BACKUP_HOUR)
    : dayAt(input.now, NEVER_BACKUP_AFTER_DAYS, BACKUP_HOUR)
  if (at <= input.now || input.dismissed.includes(key)) return []
  return [{
    key,
    page: 'settings',
    title: '백업 권장',
    body: hasBackup
      ? `마지막 백업 후 ${BACKUP_AFTER_DAYS}일이 지났습니다. 지금 백업해 주세요.`
      : '아직 백업한 적이 없습니다. 앱을 지우거나 휴대폰을 바꾸면 기록이 사라질 수 있습니다.',
    at,
  }]
}

export function planDeviceNotices(input: DeviceNoticeInput): Array<DeviceNotice> {
  const kinds: Array<[string, (value: DeviceNoticeInput) => Array<DeviceNotice>]> = [
    ['today', todayNotices],
    ['overdue', overdueNotices],
    ['backup', backupNotices],
  ]
  return kinds.flatMap(([kind, plan]) => (input.off.includes(kind) ? [] : plan(input)))
}

export function readDeviceNoticeInput(ownerKey: string, session: AppSession | null, now: Date = new Date()): DeviceNoticeInput {
  const workDataByLogId = loadWorkDataByLogId(ownerKey)
  return {
    now,
    workDataByLogId,
    receivables: getReceivableItems(buildFinanceSettings(ownerKey), workDataByLogId),
    dismissed: readDismissedIds(ownerKey),
    off: readOwnerSettings(ownerKey).notifOff || [],
    guest: ownerKey === 'guest' && !isCloudSession(session),
    lastBackupAt: getLastBackupAt(),
  }
}
