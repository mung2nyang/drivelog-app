import { commitClients } from '../store/commitHelpers.ts'
import type { ClientLike } from '../../domain/clientTypes.ts'

export function saveClients(ownerKey: string, clients: ClientLike[]) {
  commitClients(ownerKey, clients)
}
