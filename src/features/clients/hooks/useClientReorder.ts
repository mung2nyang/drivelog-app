import { useState } from 'react'
import { requestClientReorder } from '../../../data/sync/clientMutations.ts'
import { getCloudUserId } from '../../../data/cloud/cloudSession.ts'
import { useToast } from '../../../shared/hooks/useToast.ts'
import type { ClientLike } from '../../../domain/clientTypes.ts'

export function useClientReorder(ownerKey: string, clients: Array<ClientLike>) {
  const showToast = useToast()
  const [dragId, setDragId] = useState<string|null>(null)

  function onDragStart(id: string) {
    setDragId(id)
  }

  async function onDrop(targetId: string) {
    if (!dragId) return
    setDragId(null)
    const result = await requestClientReorder({ ownerKey, userId: getCloudUserId(), clients, fromId: dragId, toId: targetId })
    if (result.toast) showToast?.(result.toast)
  }

  function onDragEnd() {
    setDragId(null)
  }

  return { dragId, onDragStart, onDrop, onDragEnd }
}
