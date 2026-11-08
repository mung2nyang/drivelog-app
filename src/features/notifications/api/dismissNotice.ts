// 알림 [닫기] — 문의 답변 알림은 서버에 봤음을 저장한 뒤, 모든 알림을 계정 설정 닫은 목록에 넣는다(이 휴대폰 옛 목록도 같이).
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

/** 닫은 알림 id — 계정 설정 목록과 이 휴대폰 옛 목록을 합친다. */
export function readDismissedIds(ownerKey: string): Array<string> {
  return [...new Set([...(readOwnerSettings(ownerKey).dismissedNotices || []), ...deviceDismissedIds(ownerKey)])]
}

/** 서버 저장이 실패하면 던지고 계정 설정도 바꾸지 않는다(알림이 남음). */
export async function dismissNotice(ownerKey: string, item: DismissibleNotice): Promise<void> {
  if (item.kind === 'inquiryAnswer' && item.inquiryId && item.answeredAt) {
    await markInquiryAnswerSeen(item.inquiryId, item.answeredAt)
  }
  const ids = [...deviceDismissedIds(ownerKey), item.id]
  await savePracticeSettings(ownerKey, (current) => addDismissedNotices(current, ids, todayKey()))
}
