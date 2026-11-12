import type { JsonValue } from '../data/store/atomicPersist.ts'
import type { CarLike } from '../domain/financeTypes.ts'
import type { ClientLike } from '../domain/clientTypes.ts'

export type EqFilters = Record<string, string | number>
export type FakeQueryResult = { data?: JsonValue, error?: { message?: string } | null }
export type FakeHandler = (arg?: EqFilters | JsonValue, extra?: EqFilters | JsonValue) => FakeQueryResult | Promise<FakeQueryResult>
export type FakeHandlers = Record<string, Record<string, FakeHandler>>
export type FakeRpcHandler = (args?: JsonValue) => FakeQueryResult | Promise<FakeQueryResult>
export type FakeOp = Array<JsonValue>
export type FakeCall = { table: string, method: string, args: Array<JsonValue>, ops: Array<FakeOp> }
type FakeChain = ReturnType<typeof chainable>
type FakeTable = {
  select: (columns?: string) => FakeChain,
  upsert: (row: JsonValue, options?: JsonValue) => FakeChain,
  insert: (row: JsonValue) => FakeChain,
  update: (row: JsonValue) => FakeChain,
  delete: () => FakeChain,
}

export function chainable(getResult: (filters: EqFilters) => FakeQueryResult | Promise<FakeQueryResult>, ops: Array<FakeOp> = []) {
  const filters: EqFilters = {}
  const note = (name: string, args: Array<JsonValue | undefined>) => { ops.push([name, ...args.filter((arg) => arg !== undefined)]) }
  const api = {
    select: (columns?: string) => { note('select', [columns]); return api },
    eq: (column: string, value: string | number) => { note('eq', [column, value]); filters[column] = value; return api },
    neq: (column: string, value: string | number) => { note('neq', [column, value]); return api },
    gte: (column: string, value: string | number) => { note('gte', [column, value]); filters[column + '>='] = value; return api },
    lte: (column: string, value: string | number) => { note('lte', [column, value]); filters[column + '<='] = value; return api },
    in: (column: string, values: Array<string | number>) => { note('in', [column, values]); return api },
    order: (column: string, options?: { ascending?: boolean }) => { note('order', [column, options]); return api },
    limit: (count: number) => { note('limit', [count]); return api },
    range: (from: number, to: number) => { note('range', [from, to]); filters['range'] = `${from}-${to}`; return api },
    maybeSingle: () => { note('maybeSingle', []); return api },
    single: () => { note('single', []); return api },
    then: (onFulfilled?: (value: FakeQueryResult) => FakeQueryResult, onRejected?: (reason: Error) => FakeQueryResult) =>
      Promise.resolve().then(() => getResult(filters)).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: Error) => FakeQueryResult) => Promise.resolve().then(() => getResult(filters)).catch(onRejected),
  }
  return api
}

export function createFakeSupabase(): {
  fakeSupabase: { from: (table: string) => FakeTable, rpc: (fn: string, args?: JsonValue) => Promise<FakeQueryResult>, auth: { signOut: () => Promise<{ error: null }> } },
  handlers: FakeHandlers,
  callCounts: Record<string, number>,
  calls: Array<FakeCall>,
  callsOf: (table: string, method: string) => Array<FakeCall>,
  resetHandlers: () => void,
  countOf: (table: string, method: string) => number,
  emptyOkHandlers: () => FakeHandlers,
} {
  const handlers: FakeHandlers = {}
  const callCounts: Record<string, number> = {}
  const calls: Array<FakeCall> = []

  function resetHandlers() {
    Object.keys(handlers).forEach((key) => delete handlers[key])
    Object.keys(callCounts).forEach((key) => delete callCounts[key])
    calls.length = 0
  }

  function record(table: string, method: string, args: Array<JsonValue | undefined>): Array<FakeOp> {
    const call: FakeCall = { table, method, args: args.filter((arg) => arg !== undefined), ops: [] }
    calls.push(call)
    return call.ops
  }

  function callsOf(table: string, method: string) {
    return calls.filter((call) => call.table === table && call.method === method)
  }

  function bump(table: string, method: string) {
    const key = `${table}.${method}`
    callCounts[key] = (callCounts[key] || 0) + 1
  }

  function countOf(table: string, method: string) {
    return callCounts[`${table}.${method}`] || 0
  }

  function unregistered(table: string, method: string): never {
    throw new Error(`등록 안 한 호출: ${table}.${method}`)
  }

  function emptyOkHandlers() {
    return {
      profiles: { select: () => ({ data: null, error: null }) },
      vehicles: { select: () => ({ data: [], error: null }) },
      clients: { select: () => ({ data: [], error: null }) },
      driver_links: { select: () => ({ data: [], error: null }) },
      tax_invoices: { select: () => ({ data: [], error: null }) },
    }
  }

  const fakeSupabase = {
    from(table: string) {
      const h = handlers[table] || {}
      return {
        select: (columns?: string) => { bump(table, 'select'); return chainable(h.select || (() => unregistered(table, 'select')), record(table, 'select', [columns])) },
        upsert: (row: JsonValue, options?: JsonValue) => { bump(table, 'upsert'); return chainable(() => (h.upsert ? h.upsert(row, options) : unregistered(table, 'upsert')), record(table, 'upsert', [row, options])) },
        insert: (row: JsonValue) => { bump(table, 'insert'); return chainable(() => (h.insert ? h.insert(row) : unregistered(table, 'insert')), record(table, 'insert', [row])) },
        update: (row: JsonValue) => { bump(table, 'update'); return chainable((filters) => (h.update ? h.update(row, filters) : unregistered(table, 'update')), record(table, 'update', [row])) },
        delete: () => { bump(table, 'delete'); return chainable(h.delete || (() => unregistered(table, 'delete')), record(table, 'delete', [])) },
      }
    },
    rpc(fnName: string, args?: JsonValue) {
      bump('rpc', fnName)
      record('rpc', fnName, [args])
      const h = (handlers.rpc || {})[fnName]
      return Promise.resolve().then(() => (h ? h(args) : unregistered('rpc', fnName)))
    },
    auth: { signOut: async () => ({ error: null }) },
  }

  return { fakeSupabase, handlers, callCounts, calls, callsOf, resetHandlers, countOf, emptyOkHandlers }
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function vehicleRowsFor(cars: Array<CarLike>): Array<JsonValue> {
  const rows: Array<JsonValue> = []
  for (const car of cars || []) {
    if (!car || car.supabaseId == null) continue
    rows.push({
      id: car.supabaseId,
      number: car.number || '',
      type: car.type === 'sub' ? 'sub' : 'main',
      tonnage: car.tonnage || '',
      driver_name: car.driverName || '',
      raw: { id: car.id || '', number: car.number || '', driverName: car.driverName || '', driverPhone: car.driverPhone || '' },
    })
  }
  return rows
}

export function clientRowsFor(clients: Array<ClientLike>): Array<JsonValue> {
  const rows: Array<JsonValue> = []
  for (const client of clients || []) {
    if (!client || client.supabaseId == null) continue
    rows.push({
      id: client.supabaseId,
      legacy_client_id: client.id || '',
      company_name: client.companyName || '',
      is_pinned: !!client.isPinned,
      raw: {
        phone: client.phone || '',
        fixedRouteLinked: !!client.fixedRouteLinked,
        fixedUnitPrice: String(client.fixedUnitPrice ?? ''),
        palletOn: !!client.palletOn,
        palletPrice: String(client.palletPrice ?? ''),
      },
    })
  }
  return rows
}
