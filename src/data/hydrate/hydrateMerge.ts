import { dedupeExpensesById } from '../../domain/expenses.ts'
import type { DriverRecord } from '../../domain/driverTypes.ts'
import type { DriverLinkLike } from '../../domain/financeTypes.ts'
import type {
  DriverLinkRow, HydrateError, JsonRecord, LocalCar, LocalDriver, LocalProfile, ProfileRow, SupabaseQueryError,
} from './hydrateMergeTypes.ts'

export function throwIfAnyHydrateError(labeledErrors: Record<string, SupabaseQueryError>) {
  const failed = Object.entries(labeledErrors).filter(([, error]) => error)
  if (!failed.length) return
  const tables = failed.map(([table]) => table).join(', ')
  const error = (new Error(`hydrate 조회 실패: ${tables}`)) as HydrateError
  error.failedTables = failed.map(([table]) => table)
  error.cause = Object.fromEntries(failed)
  throw error
}

export function mergeProfileRow(localProfile: LocalProfile, profileRow: ProfileRow) {
  return {
    ...localProfile,
    name: profileRow?.name || localProfile.name || '',
    phone: profileRow?.phone || localProfile.phone || '',
    bizName: profileRow?.business_name || localProfile.bizName || '',
    bizNumber: profileRow?.business_number || localProfile.bizNumber || '',
    bizAddress: profileRow?.business_address || localProfile.bizAddress || '',
    bizType: profileRow?.business_type || localProfile.bizType || '',
    bizItem: profileRow?.business_item || localProfile.bizItem || '',
    bizEmail: profileRow?.business_email || localProfile.bizEmail || '',
    bizRepresentative: profileRow?.business_representative || localProfile.bizRepresentative || '',
    bankName: profileRow?.bank_name || localProfile.bankName || '',
    accountNumber: profileRow?.account_number || localProfile.accountNumber || '',
    accountHolder: profileRow?.account_holder || localProfile.accountHolder || '',
  }
}

export { mergeCarsFromRows } from './hydrateMergeCars.ts'
export { mergeClientsFromRows } from './hydrateMergeClients.ts'
export { mergeWorkDataFromRows } from './hydrateMergeWork.ts'

export function mergeDriversFromRows(localDrivers: Array<LocalDriver>, mergedCars: Array<LocalCar>, linkRows: Array<DriverLinkRow> | null | undefined): Array<DriverRecord> {
  if (!Array.isArray(linkRows)) return (localDrivers) as Array<DriverRecord>
  const byCode = new Map((localDrivers || []).map((item) => [item.inviteCode, item]))
  const merged = linkRows.filter((row) => row.status !== 'disconnected').map((row) => {
    const car = (mergedCars || []).find((item) => item.supabaseId === row.vehicle_id)
    const local = byCode.get(row.invite_code) || (localDrivers || []).find((item) => item.supabaseId === row.id) || {}
    return {
      id: local.id || String(row.id),
      supabaseId: row.id,
      inviteCode: row.invite_code || '',
      vehicleNumber: car?.number || local.vehicleNumber || '',
      startDate: row.assignment_start || '',
      endDate: row.assignment_end || '',
      status: (row.status === 'linked' ? 'linked' : 'pending') as 'pending' | 'linked',
      name: car?.driverName || local.name || local.driverName || '기사',
      phone: car?.driverPhone || local.phone || '',
      unlinkRequestedBy: row.unlink_requested_by || '',
      unlinkRequestedAt: row.unlink_requested_at || '',
    }
  })
  return merged
}

export function driverHistoryFromRows(linkRows: Array<DriverLinkRow> | null | undefined, cars: Array<LocalCar>): Array<DriverLinkLike> {
  if (!Array.isArray(linkRows)) return []
  const history: Array<DriverLinkLike> = []
  for (const row of linkRows) {
    if (row.status !== 'disconnected' || !row.assignment_start || !row.assignment_end) continue
    const car = (cars || []).find((item) => item.supabaseId === row.vehicle_id)
    if (!car?.number) continue
    const driverName = String(row.driver_name || '').trim()
    history.push({ id: String(row.id), vehicleNumber: car.number, assignmentStart: row.assignment_start, assignmentEnd: row.assignment_end, status: 'disconnected', ...(driverName ? { driverName } : {}) })
  }
  return history.sort((a, b) => String(a.assignmentStart).localeCompare(String(b.assignmentStart)))
}

export function findMainCar(cars: Array<LocalCar>) {
  return (cars || []).find((car) => car.type === 'main' && car.supabaseId) || null
}

export function mergeExpenseKind<Row>({ kind, currentExpenses, snapshotExpenses, previousExpenses, rows, mapRow, replace }: {
  kind: string,
  currentExpenses: Array<JsonRecord>,
  snapshotExpenses?: Array<{ kind: string }>,
  previousExpenses?: Array<{ kind: string }>,
  rows?: Array<Row>,
  mapRow: (row: Row, index: number) => JsonRecord,
  replace: (currentExpenses: Array<JsonRecord>, keep: Array<JsonRecord>) => Array<JsonRecord>,
}) {
  if (rows && rows.length) {
    return dedupeExpensesById(replace(currentExpenses, rows.map((row, index) => mapRow(row, index))))
  }
  const snapshotKind = (snapshotExpenses || []).filter((item) => item.kind === kind)
  const localKind = (previousExpenses || []).filter((item) => item.kind === kind)
  const keep = snapshotKind.length ? snapshotKind : localKind
  return dedupeExpensesById(replace(currentExpenses, keep))
}
