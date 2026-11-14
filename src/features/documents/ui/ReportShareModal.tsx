import {
  getDetailReportClientContact,
  getReportShareCompanyName,
} from '../api/report.ts'
import { fillReportShareMessagePattern, getReportShareMessagePattern } from '../../../data/sync/messageTemplates.ts'
import ShareFileModal from './ShareFileModal.tsx'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import { useOwnerSettings } from '../../../data/store/ownerDataHooks.ts'
import type { ClientLike } from '../../../domain/clientTypes.ts'

const NO_CONTACT = '문자로 보내려면 [세부 내역]에서 거래처를 하나 고르고, 그 거래처에 연락처가 있는지 확인해 주세요.'

type ReportShareModalProps = {
  buildFile: (type: 'pdf'|'image') => Promise<File>
  viewMode: 'summary'|'detail'
  clientFilter: string
  clients: Array<ClientLike>|null|undefined
  onClose: () => void
}

export default function ReportShareModal({ buildFile, viewMode, clientFilter, clients, onClose }: ReportShareModalProps) {
  const { ownerKey } = useSession()
  const pattern = getReportShareMessagePattern(useOwnerSettings(ownerKey))
  const companyName = getReportShareCompanyName(viewMode, clientFilter)
  const contact = getDetailReportClientContact(viewMode, clientFilter, clients)

  return (
    <ShareFileModal
      title="내역서 보내기"
      kakaoHint="파일과 설정한 안내 문구를 함께 공유합니다."
      smsHint="설정한 안내 문구를 포함해 문자 앱을 엽니다."
      shareTitle="운송비 내역서"
      kakaoText={fillReportShareMessagePattern(pattern, companyName)}
      unsupportedToast="이 휴대폰에서는 파일 공유를 할 수 없습니다. [PDF 다운로드]로 저장한 뒤 보내 주세요."
      logLabel="내역서"
      buildFile={buildFile}
      smsTarget={() => (contact
        ? { phone: contact.phone, message: fillReportShareMessagePattern(pattern, contact.name) }
        : NO_CONTACT)}
      onClose={onClose}
    />
  )
}
