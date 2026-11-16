import ConfirmModal from '../../../shared/ui/ConfirmModal.tsx'
import ClientFormModal from './ClientFormModal.tsx'
import ClientListItem from './ClientListItem.tsx'
import { useScopedClients } from '../hooks/useScopedClients.ts'
import '../../drivers/ui/linked-driver.css'
import './client-management.css'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import type { ReactNode } from 'react'

export default function ScopedClientsList({ scopeKey, listId, notice }: { scopeKey: string, listId: string, notice?: ReactNode }) {
  const { ownerKey } = useSession()
  const scoped = useScopedClients({ ownerKey, scopeKey })

  return (
    <>
      <div className="client-list" id={listId}>
        {notice}
        {!scoped.scopedClients.length ? (
          <div className="empty-state">등록된 거래처가 없습니다.</div>
        ) : (
          scoped.scopedClients.map((client) => (
            <ClientListItem
              key={client.id}
              client={client}
              onEdit={() => scoped.openEdit(client)}
              onDelete={() => scoped.setPendingDelete(client)}
            />
          ))
        )}
      </div>
      <button type="button" className="management-add-fab" onClick={() => scoped.openAdd()}>+ 추가</button>
      {scoped.modalOpen && (
        <ClientFormModal
          draft={scoped.draft}
          setDraft={scoped.setDraft}
          editingId={scoped.editingId}
          onCancel={scoped.closeModal}
          onSave={scoped.save}
          clients={scoped.scopedClients}
        />
      )}
      {scoped.pendingDelete && (
        <ConfirmModal
          title="이 거래처를 삭제하시겠습니까?"
          confirmLabel="삭제"
          danger
          onCancel={() => scoped.setPendingDelete(null)}
          onConfirm={scoped.confirmRemove}
        />
      )}
    </>
  )
}
