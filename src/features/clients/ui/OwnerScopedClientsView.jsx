// @ts-check
import PageHeader from '../../../shared/ui/PageHeader.tsx'
import ScopedClientsList from './ScopedClientsList.jsx'
import { useOwnerCars } from '../../../data/store/ownerDataHooks.ts'
import { useSession } from '../../../data/cloud/sessionContext.ts'

/**
 * @param {Object} props
 * @param {() => void} [props.onBack]
 * @param {(() => void)} [props.onOpenMenu]
 */
export default function OwnerScopedClientsView({ onBack, onOpenMenu }) {
  const { ownerKey } = useSession()
  const cars = useOwnerCars(ownerKey)
  const scopeKey = cars[0]?.number || ''

  return (
    <div className="page client-management-page">
      <PageHeader title="거래처" onBack={onBack} onOpenMenu={onOpenMenu} />
      <ScopedClientsList
        scopeKey={scopeKey}
        listId="ownerScopedClientsListContainer"
        notice={(
          <p className="linked-driver-readonly-notice" style={{ marginBottom: 10 }}>
            <span>차주와 공유하는 거래처 목록입니다. 여기서 거래처를 등록, 수정, 삭제하면 차주 화면에도 반영됩니다.</span>
          </p>
        )}
      />
    </div>
  )
}
