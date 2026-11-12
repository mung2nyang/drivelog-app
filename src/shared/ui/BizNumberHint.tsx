import { isBizNumberChecksumOk } from '../../domain/formatPhone.ts'

export default function BizNumberHint({ value }: { value: string | undefined }) {
  if (isBizNumberChecksumOk(value || '')) return null
  return <p className="biz-number-hint">* 사업자등록번호를 다시 확인해 주세요</p>
}
