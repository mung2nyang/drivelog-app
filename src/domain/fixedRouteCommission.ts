import { parseCurrencyValue } from './money.ts'
import type { ClientLike } from './clientTypes.ts'

export function getFixedRouteCommissionAmount(client: ClientLike | null | undefined, amount: number, fixedCount: number): number {
  if (!client?.commEnabled) return 0
  if (client.commType === 'percent' || !client.commType) {
    return Math.floor(amount * ((parseFloat(String(client.commValue)) || 0) / 100))
  }
  return parseCurrencyValue(client.commValue) * Math.max(1, fixedCount)
}
