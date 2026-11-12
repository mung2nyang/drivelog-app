import type { JsonValue } from '../../domain/jsonTypes.ts'
import { supabase } from '../cloud/supabaseClient.ts'
import { fetchAllRows } from '../cloud/fetchAllRows.ts'
import { buildFuelRecordRow, expenseFromFuelRecord } from '../../domain/fuelRecords.ts'
import { buildMaintenanceRecordRow, expenseFromMaintenanceRecord, parseEntityNumber } from '../../domain/maintenanceRecords.ts'
import { buildMiscExpenseRecordRow, expenseFromMiscRecord } from '../../domain/miscExpenseRecords.ts'
import type { ExpenseItem } from '../../domain/expenseTypes.ts'

export type RowContext = { dailyLogId: string, userId: string, vehicleId: string | number, workDate: string }
export type ServerRow = { id: string, raw?: JsonValue, work_date?: string, sequence?: number }
export type KindSpec = {
  kind: 'fuel' | 'maint' | 'misc'
  table: string
  buildRow: (item: ExpenseItem, index: number, ctx: RowContext) => Record<string, JsonValue>
  mapRow: (row: ServerRow, index: number) => ExpenseItem
}
export type SyncContext = {
  userId: string
  vehicleId: string | number
  previous: Array<ExpenseItem>
  next: Array<ExpenseItem>
  workData: Record<string, JsonValue | undefined>
  idByDate: Map<string, string>
  legacyVehicleId: string | number | null
  restoreMissing: boolean
  deletes: Array<ExpenseRowRef>
}
export type ExpenseRowRef = { table: string, id: string }

const KIND_SPECS: Array<KindSpec> = [
  { kind: 'fuel', table: 'fuel_records', buildRow: buildFuelRecordRow, mapRow: expenseFromFuelRecord },
  { kind: 'maint', table: 'maintenance_records', buildRow: buildMaintenanceRecordRow, mapRow: expenseFromMaintenanceRecord },
  { kind: 'misc', table: 'misc_expense_records', buildRow: buildMiscExpenseRecordRow, mapRow: expenseFromMiscRecord },
]

async function dailyLogIdsByDate(vehicleId: string | number): Promise<Map<string, string>> {
  const { data, error } = await fetchAllRows(() => supabase.from('daily_logs').select('id, work_date').eq('vehicle_id', vehicleId).order('id'))
  if (error) throw error
  return new Map((data || []).map((row) => [row.work_date, row.id]))
}

async function ensureDailyLog(ctx: SyncContext, workDate: string): Promise<string> {
  const known = ctx.idByDate.get(workDate)
  if (known) return known
  const record = ctx.workData[workDate]
  const safeRecord = (record && typeof record === 'object' ? record : { isOff: false, fixedCount: 0 }) as Record<string, JsonValue | undefined>
  const { callDetails: _callDetails, fuelItems: _fuelItems, maintItems: _maintItems, miscItems: _miscItems, ...dailyFields } = safeRecord
  const { error } = await supabase.from('daily_logs').upsert({
    user_id: ctx.userId,
    vehicle_id: ctx.vehicleId,
    work_date: workDate,
    is_off: !!safeRecord.isOff,
    fixed_count: parseEntityNumber(safeRecord.fixedCount),
    pallet_count: parseEntityNumber(safeRecord.palletCount),
    raw: dailyFields,
  }, { onConflict: 'vehicle_id,work_date', ignoreDuplicates: true })
  if (error) throw error
  const { data, error: readError } = await supabase
    .from('daily_logs').select('id').eq('vehicle_id', ctx.vehicleId).eq('work_date', workDate).single()
  if (readError) throw readError
  const id = (data?.id) as string
  ctx.idByDate.set(workDate, id)
  return id
}

async function fetchRows(spec: KindSpec, vehicleId: string | number): Promise<Array<ServerRow>> {
  const { data, error } = await fetchAllRows(() => supabase
    .from(spec.table).select('id, raw, work_date, sequence').eq('vehicle_id', vehicleId).order('sequence', { ascending: true }).order('id'))
  if (error) throw error
  return (data || []) as Array<ServerRow>
}

async function syncKind(spec: KindSpec, ctx: SyncContext) {
  const rows = await fetchRows(spec, ctx.vehicleId)
  const legacyIds = ctx.legacyVehicleId != null
    ? new Set((await fetchRows(spec, ctx.legacyVehicleId)).map((row, index) => spec.mapRow(row, index).id))
    : new Set<string>()
  const serverByItemId: Map<string, ServerRow> = new Map()
  const lastSequenceByDate: Map<string, number> = new Map()
  rows.forEach((row, index) => {
    serverByItemId.set(spec.mapRow(row, index).id, row)
    const date = String(row.work_date || '')
    lastSequenceByDate.set(date, Math.max(lastSequenceByDate.get(date) ?? -1, Number(row.sequence) || 0))
  })
  const previousById = new Map(ctx.previous.filter((item) => item.kind === spec.kind).map((item) => [item.id, item]))
  const nextItems = ctx.next.filter((item) => item.kind === spec.kind && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')))
  const nextIds = new Set(nextItems.map((item) => item.id))

  for (const item of nextItems) {
    const row = serverByItemId.get(item.id)
    const previous = previousById.get(item.id)
    const unchanged = !!previous && JSON.stringify(previous) === JSON.stringify(item)
    if (unchanged && (row || (!legacyIds.has(item.id) && !ctx.restoreMissing))) continue
    const dailyLogId = await ensureDailyLog(ctx, item.date)
    const rowContext = { dailyLogId, userId: ctx.userId, vehicleId: ctx.vehicleId, workDate: item.date }
    if (!row) {
      const sequence = (lastSequenceByDate.get(item.date) ?? -1) + 1
      lastSequenceByDate.set(item.date, sequence)
      const { error: insertError } = await supabase.from(spec.table).insert(spec.buildRow(item, sequence, rowContext))
      if (insertError) throw insertError
      continue
    }
    const { user_id: _userId, ...changes } = spec.buildRow(item, Number(row.sequence) || 0, rowContext)
    const { error: updateError } = await supabase.from(spec.table).update(changes).eq('id', row.id)
    if (updateError) throw updateError
  }

  for (const id of previousById.keys()) {
    if (nextIds.has(id)) continue
    const row = serverByItemId.get(id)
    if (row) ctx.deletes.push({ table: spec.table, id: row.id })
  }
}

export async function syncExpenseItemsForVehicle(userId: string, vehicleId: string | number, previous: Array<ExpenseItem>, next: Array<ExpenseItem>, workData: Record<string, JsonValue | undefined>, legacyVehicleId: string | number | null = null, restoreMissing = false) {
  await deleteExpenseRows(await upsertExpenseItemsForVehicle(userId, vehicleId, previous, next, workData, legacyVehicleId, restoreMissing))
}

export async function upsertExpenseItemsForVehicle(userId: string, vehicleId: string | number, previous: Array<ExpenseItem>, next: Array<ExpenseItem>, workData: Record<string, JsonValue | undefined>, legacyVehicleId: string | number | null = null, restoreMissing = false): Promise<Array<ExpenseRowRef>> {
  const ctx: SyncContext = { userId, vehicleId, previous, next, workData, legacyVehicleId, restoreMissing, idByDate: await dailyLogIdsByDate(vehicleId), deletes: [] }
  for (const spec of KIND_SPECS) {
    await syncKind(spec, ctx)
  }
  return ctx.deletes
}

export async function deleteExpenseRows(rows: Array<ExpenseRowRef>) {
  for (const row of rows) {
    const { error } = await supabase.from(row.table).delete().eq('id', row.id)
    if (error) throw error
  }
}
