import type { JsonValue } from '../../../domain/jsonTypes.ts'
import { addDismissedNotices } from '../../../domain/dismissedNotices.ts'
import { todayKey } from '../../../domain/expenses.ts'
import { markInquiryAnswerSeen } from '../../../data/cloud/inquiryNotices.ts'
import { readJsonKey } from '../../../data/store/persist.ts'
import { readOwnerSettings } from '../../../data/store/ownerDataHooks.ts'
import { savePracticeSettings } from '../../../data/sync/settingsSave.ts'

export type DismissibleNotice = { id: string, kind: string, inquiryId?: string, answeredAt?: string }

function deviceDismissedIds(ownerKey: string): Array<string> {
  const saved = readJsonKey<JsonValue>('dismissedNotifications', ownerKey, [])
  return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []
}

export function readDismissedIds(ownerKey: string): Array<string> {
  return [...new Set([...(readOwnerSettings(ownerKey).dismissedNotices || []), ...deviceDismissedIds(ownerKey)])]
}

export async function dismissNotice(ownerKey: string, item: DismissibleNotice): Promise<void> {
  if (item.kind === 'inquiryAnswer' && item.inquiryId && item.answeredAt) {
    await markInquiryAnswerSeen(item.inquiryId, item.answeredAt)
  }
  const ids = [...deviceDismissedIds(ownerKey), item.id]
  await savePracticeSettings(ownerKey, (current) => addDismissedNotices(current, ids, todayKey()))
}
