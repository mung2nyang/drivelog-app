import ShareFileModal from './ShareFileModal.tsx'

type DailyInspectionShareModalProps = {
  month: number
  buildFile: (type: 'pdf'|'image') => Promise<File>
  onClose: () => void
}

export default function DailyInspectionShareModal({ month, buildFile, onClose }: DailyInspectionShareModalProps) {
  const message = `안녕하세요. ${month + 1}월 일상점검표입니다. 확인 부탁드립니다.`
  return (
    <ShareFileModal
      title="점검표 보내기"
      kakaoHint="파일과 안내 문구를 함께 공유합니다."
      smsHint="파일을 저장한 뒤 문자 앱을 엽니다. 받는 사람을 직접 선택해 주세요."
      shareTitle="일상점검표"
      kakaoText={message}
      unsupportedToast="이 기기에서는 파일 공유를 지원하지 않습니다."
      logLabel="일상점검표"
      buildFile={buildFile}
      smsTarget={() => ({ phone: '', message })}
      onClose={onClose}
    />
  )
}
