import type { CallDetailLike } from '../../domain/callDetail.ts'

export type EffectiveCallDetail = CallDetailLike & { id: string }

export type EffectivePatch = {
  isOff: boolean
  fixedCount: number
  palletCount: number
  callDetails: Array<EffectiveCallDetail>
  fixedRouteCounts: Record<string, number>
}

export type DurableReadResult = { ok: true, value: Record<string, EffectivePatch> } | { ok: false }

export type OwnerEnumerationResult = { ok: true, owners: Array<string> } | { ok: false }
