import { useState } from 'react'
import { downloadFile } from '../api/reportExport.ts'
import { useToast } from '../../../shared/hooks/useToast.ts'

export default function useFileDownload(buildFile: (type: 'pdf'|'image') => Promise<File>, logLabel: string) {
  const showToast = useToast()
  const [saving, setSaving] = useState<'pdf'|'image'|null>(null)

  async function download(type: 'pdf'|'image') {
    if (saving) return
    setSaving(type)
    try {
      const hint = await downloadFile(await buildFile(type))
      showToast?.(`${type === 'pdf' ? 'PDF를 저장했습니다.' : '이미지를 저장했습니다.'}${hint}`)
    } catch (error) {
      console.error(`${logLabel} 내보내기 실패:`, error)
      showToast?.(type === 'pdf' ? 'PDF 저장에 실패했습니다. 다시 시도해 주세요.' : '이미지 저장에 실패했습니다.')
    } finally {
      setSaving(null)
    }
  }

  return { saving, download }
}
