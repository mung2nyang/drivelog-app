// @ts-check
import { Route, Routes } from 'react-router-dom'
import ReceivablesListPage from './ReceivablesListPage.jsx'
import ReceivablesDetailPage from './ReceivablesDetailPage.jsx'
import { useSession } from '../../../data/cloud/sessionContext.ts'

/**
 * @param {Object} props
 * @param {boolean} [props.isEmployedDriver]
 * @param {() => void} [props.onBack]
 * @param {(() => void)} [props.onOpenMenu]
 */
export default function ReceivablesPage({ isEmployedDriver = false, onBack, onOpenMenu }) {
  const { ownerKey } = useSession()
  const shared = { ownerKey, isEmployedDriver }
  return (
    <Routes>
      <Route index element={<ReceivablesListPage {...shared} onBack={onBack} onOpenMenu={onOpenMenu} />} />
      <Route path=":client/:month" element={<ReceivablesDetailPage {...shared} />} />
    </Routes>
  )
}
