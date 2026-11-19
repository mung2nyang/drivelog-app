import OwnerRevenueView from './OwnerRevenueView.tsx'
import DriverRevenueView from './DriverRevenueView.tsx'
import PageHeader from '../../../shared/ui/PageHeader.tsx'
import './revenue.css'
import './revenue-controls.css'
import { useSession } from '../../../data/cloud/sessionContext.ts'

export default function RevenuePage({ onOpenMenu }: { onOpenMenu?: (() => void) }) {
  const { session } = useSession()
  const isDriver = session?.accountType === 'employed_driver'

  return (
    <div className="page revenue-page">
      <PageHeader title="매출" onOpenMenu={onOpenMenu} />
      {isDriver
        ? <DriverRevenueView />
        : <OwnerRevenueView />}
      {!isDriver && <p className="revenue-tax-note">매출과 정산 금액은 앱에 입력한 기록으로 계산해요. 세무 신고 전 실제 거래 내역과 맞는지 확인해 주세요.</p>}
    </div>
  )
}
