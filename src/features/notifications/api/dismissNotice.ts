// 알림 [닫기] — 문의 답변 알림은 서버에 봤음을 저장한 뒤, 모든 알림은 이 기기 닫은 목록에도 넣는다.
import { markInquiryAnswerSeen } from '../../../data/cloud/inquiryNotices.ts'
import { dismissNotification } from './notifications.js'

export type DismissibleNotice = { id: string, kind: string, inquiryId?: string, answeredAt?: string }

/** 서버 저장이 실패하면 던지고 기기 목록도 바꾸지 않는다(알림이 남음). */
export async function dismissNotice(ownerKey: string, item: DismissibleNotice): Promise<void> {
  if (item.kind === 'inquiryAnswer' && item.inquiryId && item.answeredAt) {
    await markInquiryAnswerSeen(item.inquiryId, item.answeredAt)
  }
  dismissNotification(ownerKey, item.id)
}
