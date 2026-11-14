import './report.css'
import './report-pdf-export.css'
import ModalShell from '../../../shared/ui/ModalShell.tsx'
import { buildSmsHref } from '../../../domain/smsHref.ts'
import { useToast } from '../../../shared/hooks/useToast.ts'
import { saveFileToDevice } from '../../../shared/utils/saveFile.ts'
import { shareFileFromDevice } from '../../../shared/utils/shareFile.ts'

const formatLabel = (type: 'pdf'|'image') => (type === 'image' ? '이미지' : 'PDF')

type ShareFileModalProps = {
  title: string
  kakaoHint: string
  smsHint: string
  shareTitle: string
  kakaoText: string
  unsupportedToast: string
  logLabel: string
  buildFile: (type: 'pdf'|'image') => Promise<File>
  smsTarget: () => { phone: string, message: string } | string
  onClose: () => void
}

export default function ShareFileModal({
  title, kakaoHint, smsHint, shareTitle, kakaoText, unsupportedToast, logLabel, buildFile, smsTarget, onClose,
}: ShareFileModalProps) {
  const showToast = useToast()
  async function shareToKakao(type: 'pdf'|'image') {
    onClose()
    try {
      showToast?.(`카카오톡으로 보낼 ${formatLabel(type)}를 준비하고 있습니다.`)
      const file = await buildFile(type)
      const shared = await shareFileFromDevice(file, { title: shareTitle, text: kakaoText })
      if (!shared) showToast?.(unsupportedToast)
    } catch (error) {
      if (error instanceof Error) {
        console.error(`카카오톡 ${logLabel} 공유 실패:`, error)
        showToast?.('카카오톡 파일 공유에 실패했습니다.')
      }
    }
  }

  async function shareBySms(type: 'pdf'|'image') {
    const target = smsTarget()
    if (typeof target === 'string') {
      showToast?.(target)
      return
    }
    onClose()
    try {
      showToast?.(`문자로 보낼 ${formatLabel(type)}를 저장하고 있습니다.`)
      const file = await buildFile(type)
      const hint = await saveFileToDevice(file, file.name)
      if (hint) showToast?.(`문자에 붙일 파일을 저장했습니다.${hint}`)
      window.location.href = buildSmsHref(target.phone, target.message, navigator.userAgent)
    } catch (error) {
      console.error(`문자용 ${logLabel} 저장 실패:`, error)
      showToast?.('문자용 파일 저장에 실패했습니다.')
    }
  }

  return (
    <ModalShell onClose={onClose} contentClassName="modal-content report-share-content" label={title}>
      <div className="report-share-head">
        <strong>{title}</strong>
        <p>전송 방법과 파일 형식을 선택해 주세요.</p>
      </div>
      <div className="report-share-options">
        <section className="report-share-channel">
          <div className="report-share-channel-title">
            <span className="report-share-file-icon kakao">톡</span>
            <span><strong>카카오톡으로 보내기</strong><small>{kakaoHint}</small></span>
          </div>
          <div className="report-share-format-buttons">
            <button type="button" onClick={() => shareToKakao('pdf')}><strong>PDF로 보내기</strong></button>
            <button type="button" onClick={() => shareToKakao('image')}><strong>이미지로 보내기</strong></button>
          </div>
        </section>
        <section className="report-share-channel">
          <div className="report-share-channel-title">
            <span className="report-share-file-icon sms">문자</span>
            <span><strong>문자로 보내기</strong><small>{smsHint}</small></span>
          </div>
          <div className="report-share-format-buttons">
            <button type="button" onClick={() => shareBySms('pdf')}><strong>PDF로 보내기</strong></button>
            <button type="button" onClick={() => shareBySms('image')}><strong>이미지로 보내기</strong></button>
          </div>
        </section>
      </div>
    </ModalShell>
  )
}
