import { useState } from 'react'
import ClientFormModal from '../../clients/ui/ClientFormModal.jsx'
import { getCloudUserId } from '../../../data/cloud/cloudSession.ts'
import { requestClientSave } from '../../../data/sync/clientMutations.ts'
import './call-client-quick-add.css'
import { useToast } from '../../../shared/hooks/useToast.ts'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import type { ClientDraft, ClientLike } from '../../../domain/clientTypes.ts'

const emptyDraft: ClientDraft = {
  companyName: '', managerName: '', phone: '', bizNumber: '', taxRepresentative: '',
  taxEmail: '', taxAddress: '', taxBizType: '', taxBizItem: '',
  paymentTerm: 'next_month_end', paymentTermValue: '', isPinned: false,
  commEnabled: false, commType: 'percent', commValue: '',
  fixedRouteLinked: false, fixedUnitPrice: '', palletOn: false, palletPrice: '',
}

type CallClientQuickAddProps = {
  clients: Array<ClientLike>
  logId?: string
  onClientAdded: (companyName: string) => void
}

export default function CallClientQuickAdd({ clients, logId = 'main', onClientAdded }: CallClientQuickAddProps) {
  const { ownerKey } = useSession()
  const showToast = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const scopeKey = !logId || logId === 'main' ? '' : logId

  function openAdd() {
    setDraft(scopeKey ? { ...emptyDraft, scopedToVehicleNumber: scopeKey } : { ...emptyDraft })
    setModalOpen(true)
  }

  async function save() {
    const payload = scopeKey
      ? { ...draft, scopedToVehicleNumber: scopeKey, fixedRouteLinked: false }
      : { ...draft }
    const result = await requestClientSave({
      ownerKey,
      userId: getCloudUserId(),
      clients,
      draft: payload,
      editingId: null,
    })
    if (result.toast) showToast?.(result.toast)
    if (result.failed) return
    setModalOpen(false)
    const name = String(result.saved?.companyName || draft.companyName || '').trim()
    if (name) onClientAdded(name)
  }

  return (
    <>
      <button type="button" className="call-client-add-btn" onClick={openAdd}>+ 추가</button>
      {modalOpen && (
        <ClientFormModal
          draft={draft}
          setDraft={setDraft}
          editingId={null}
          onCancel={() => setModalOpen(false)}
          onSave={save}
          clients={clients}
        />
      )}
    </>
  )
}
