// @ts-check
import { INVITE_CODE_PATTERN, normalizeInviteCode } from '../../../domain/drivers.ts'
import { buildSmsHref } from '../../../domain/smsHref.ts'

/**
 * @param {{ name?: string, phone?: string, inviteCode?: string, vehicleNumber?: string, ownerDisplayName?: string, userAgent?: string }} input
 * @returns {{ error: string }|{ href: string }}
 */
export function buildDriverInviteSmsHref({
  name = '', phone = '', inviteCode = '', ownerDisplayName = '운송사', userAgent = '',
}) {
  const trimmedPhone = phone.trim()
  if (!trimmedPhone || trimmedPhone.replace(/\D/g, '').length < 10) {
    return { error: '기사 전화번호를 먼저 올바르게 입력해 주세요.' }
  }
  const code = normalizeInviteCode(inviteCode)
  if (!INVITE_CODE_PATTERN.test(code)) {
    return { error: '[코드 생성]으로 초대 코드를 먼저 만들어 주세요.' }
  }
  const trimmedName = name.trim()
  const message = `[운행일지] 안녕하세요, ${ownerDisplayName}입니다.${trimmedName ? ` ${trimmedName}기사님,` : ''}\n소속 기사 연동 초대 코드입니다.\n\n▶ 초대 코드\n${code}\n\n[등록 방법]\n1. 이 문자를 길게 눌러 [복사]\n2. 운행일지 앱 → 마이페이지 → [초대 코드 입력]\n3. 입력 칸을 길게 눌러 [붙여넣기] (코드만 자동으로 들어갑니다)\n초대 저장 후 7일 동안 사용할 수 있습니다.`
  return { href: buildSmsHref(trimmedPhone, message, userAgent) }
}
