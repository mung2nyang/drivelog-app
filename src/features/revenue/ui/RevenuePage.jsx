// @ts-check
import OwnerRevenueView from './OwnerRevenueView.jsx'
import DriverRevenueView from './DriverRevenueView.jsx'
import PageHeader from '../../../shared/ui/PageHeader.tsx'
import './revenue.css'
import './revenue-controls.css'
import { useSession } from '../../../data/cloud/sessionContext.ts'

/**
 * @param {Object} props
 * @param {(() => void)} [props.onOpenMenu]
 */
export default function RevenuePage({ onOpenMenu }) {
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
