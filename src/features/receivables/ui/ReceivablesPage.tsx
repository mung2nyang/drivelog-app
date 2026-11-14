import { Route, Routes } from 'react-router-dom'
import ReceivablesListPage from './ReceivablesListPage.tsx'
import ReceivablesDetailPage from './ReceivablesDetailPage.tsx'
import { useSession } from '../../../data/cloud/sessionContext.ts'

type ReceivablesPageProps = {
  isEmployedDriver?: boolean
  onBack?: () => void
  onOpenMenu?: (() => void)
}

export default function ReceivablesPage({ isEmployedDriver = false, onBack, onOpenMenu }: ReceivablesPageProps) {
  const { ownerKey } = useSession()
  const shared = { ownerKey, isEmployedDriver }
  return (
    <Routes>
      <Route index element={<ReceivablesListPage {...shared} onBack={onBack} onOpenMenu={onOpenMenu} />} />
      <Route path=":client/:month" element={<ReceivablesDetailPage {...shared} />} />
    </Routes>
  )
}
