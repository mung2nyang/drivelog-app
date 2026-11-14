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
    </div>
  )
}
