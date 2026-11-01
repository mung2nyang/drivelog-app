// Step 0-4 감사 보완 4차: hydrate 등 테스트가 공유하는 가짜 supabase
// 클라이언트. mock.module()로 실제 supabaseClient.js를 바꿔치기하는 각 테스트 파일이
// 이 팩토리로 handlers/callCounts를 매번 새로 만든다(파일 간 상태 공유 없음 — 테스트
// 독립성).

/** @typedef {Record<string, string|number>} EqFilters */
/** @typedef {{ data?: import('../data/store/atomicPersist.ts').JsonValue, error?: { message?: string } | null }} FakeQueryResult */
/** @typedef {(arg?: EqFilters | import('../data/store/atomicPersist.ts').JsonValue, extra?: EqFilters | import('../data/store/atomicPersist.ts').JsonValue) => FakeQueryResult | Promise<FakeQueryResult>} FakeHandler */
/** @typedef {Record<string, Record<string, FakeHandler>>} FakeHandlers */
/** @typedef {(args?: import('../data/store/atomicPersist.ts').JsonValue) => FakeQueryResult | Promise<FakeQueryResult>} FakeRpcHandler */
/** @typedef {Array<import('../data/store/atomicPersist.ts').JsonValue>} FakeOp 조건 이름과 넘긴 값 */
/** @typedef {{ table: string, method: string, args: Array<import('../data/store/atomicPersist.ts').JsonValue>, ops: Array<FakeOp> }} FakeCall */

/**
 * @param {(filters: EqFilters) => FakeQueryResult | Promise<FakeQueryResult>} getResult
 * @param {Array<FakeOp>} [ops] 붙인 조건을 순서대로 적어 둘 곳
 */
export function chainable(getResult, ops = []) {
  /** @type {EqFilters} */
  const filters = {}
  /** @param {string} name @param {Array<import('../data/store/atomicPersist.ts').JsonValue|undefined>} args */
  const note = (name, args) => { ops.push([name, ...args.filter((arg) => arg !== undefined)]) }
  const api = {
    /** @param {string} [columns] */
    select: (columns) => { note('select', [columns]); return api },
    /** @param {string} column @param {string|number} value */
    eq: (column, value) => { note('eq', [column, value]); filters[column] = value; return api },
    /** @param {string} column @param {string|number} value */
    neq: (column, value) => { note('neq', [column, value]); return api },
    /** @param {string} column @param {string|number} value */
    gte: (column, value) => { note('gte', [column, value]); filters[column + '>='] = value; return api },
    /** @param {string} column @param {string|number} value */
    lte: (column, value) => { note('lte', [column, value]); filters[column + '<='] = value; return api },
    /** @param {string} column @param {Array<string|number>} values */
    in: (column, values) => { note('in', [column, values]); return api },
    /** @param {string} column @param {{ ascending?: boolean }} [options] */
    order: (column, options) => { note('order', [column, options]); return api },
    /** @param {number} count */
    limit: (count) => { note('limit', [count]); return api },
    /** @param {number} from @param {number} to */
    range: (from, to) => { note('range', [from, to]); filters['range'] = `${from}-${to}`; return api },
    maybeSingle: () => { note('maybeSingle', []); return api },
    single: () => { note('single', []); return api },
    /**
     * @param {(value: FakeQueryResult) => FakeQueryResult} [onFulfilled]
     * @param {(reason: Error) => FakeQueryResult} [onRejected]
     */
    then: (onFulfilled, onRejected) => Promise.resolve().then(() => getResult(filters)).then(onFulfilled, onRejected),
    /** @param {(reason: Error) => FakeQueryResult} [onRejected] */
    catch: (onRejected) => Promise.resolve().then(() => getResult(filters)).catch(onRejected),
  }
  return api
}

/** @returns {{ fakeSupabase: { from: (table: string) => ReturnType<typeof chainable>, rpc: (fn: string, args?: import('../data/store/atomicPersist.ts').JsonValue) => Promise<FakeQueryResult>, auth: { signOut: () => Promise<{ error: null }> } }, handlers: FakeHandlers, callCounts: Record<string, number>, calls: Array<FakeCall>, callsOf: (table: string, method: string) => Array<FakeCall>, resetHandlers: () => void, countOf: (table: string, method: string) => number, emptyOkHandlers: () => FakeHandlers }} */
export function createFakeSupabase() {
  /** @type {FakeHandlers} */
  const handlers = {}
  /** @type {Record<string, number>} */
  const callCounts = {}
  /** 받은 호출을 순서대로: 표·동작·넘긴 값·붙인 조건 @type {Array<FakeCall>} */
  const calls = []

  function resetHandlers() {
    Object.keys(handlers).forEach((key) => delete handlers[key])
    Object.keys(callCounts).forEach((key) => delete callCounts[key])
    calls.length = 0
  }

  /** @param {string} table @param {string} method @param {Array<import('../data/store/atomicPersist.ts').JsonValue|undefined>} args @returns {Array<FakeOp>} */
  function record(table, method, args) {
    /** @type {FakeCall} */
    const call = { table, method, args: args.filter((arg) => arg !== undefined), ops: [] }
    calls.push(call)
    return call.ops
  }

  /** @param {string} table @param {string} method */
  function callsOf(table, method) {
    return calls.filter((call) => call.table === table && call.method === method)
  }

  /** @param {string} table @param {string} method */
  function bump(table, method) {
    const key = `${table}.${method}`
    callCounts[key] = (callCounts[key] || 0) + 1
  }

  /** @param {string} table @param {string} method */
  function countOf(table, method) {
    return callCounts[`${table}.${method}`] || 0
  }

  // 등록 안 한 호출은 기다리는 곳에서 오류.
  /** @param {string} table @param {string} method @returns {never} */
  function unregistered(table, method) {
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
    /** @param {string} table */
    from(table) {
      const h = handlers[table] || {}
      return {
        /** @param {string} [columns] */
        select: (columns) => { bump(table, 'select'); return chainable(h.select || (() => unregistered(table, 'select')), record(table, 'select', [columns])) },
        /** @param {import('../data/store/atomicPersist.ts').JsonValue} row @param {import('../data/store/atomicPersist.ts').JsonValue} [options] */
        upsert: (row, options) => { bump(table, 'upsert'); return chainable(() => (h.upsert ? h.upsert(row, options) : unregistered(table, 'upsert')), record(table, 'upsert', [row, options])) },
        /** @param {import('../data/store/atomicPersist.ts').JsonValue} row */
        insert: (row) => { bump(table, 'insert'); return chainable(() => (h.insert ? h.insert(row) : unregistered(table, 'insert')), record(table, 'insert', [row])) },
        /** @param {import('../data/store/atomicPersist.ts').JsonValue} row */
        update: (row) => { bump(table, 'update'); return chainable((filters) => (h.update ? h.update(row, filters) : unregistered(table, 'update')), record(table, 'update', [row])) },
        delete: () => { bump(table, 'delete'); return chainable(h.delete || (() => unregistered(table, 'delete')), record(table, 'delete', [])) },
      }
    },
    // handlers.rpc[함수이름]이 있으면 그 답, 없으면 위와 같이 처리.
    /** @param {string} fnName @param {import('../data/store/atomicPersist.ts').JsonValue} [args] */
    rpc(fnName, args) {
      bump('rpc', fnName)
      record('rpc', fnName, [args])
      const h = (handlers.rpc || {})[fnName]
      return Promise.resolve().then(() => (h ? h(args) : unregistered('rpc', fnName)))
    },
    auth: { signOut: async () => ({ error: null }) },
  }

  return { fakeSupabase, handlers, callCounts, calls, callsOf, resetHandlers, countOf, emptyOkHandlers }
}

/** @param {number} ms */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 슬라이스 C: hydrate가 "빈 배열 = 서버 정본(로컬 삭제)"으로 바뀌어서, 로컬 Store에
// supabaseId 있는 차량/거래처를 시드한 테스트는 가짜 서버에도 같은 행을 돌려줘야
// hydrate가 그 데이터를 지우지 않는다. buildVehicleRow/buildClientRow처럼 raw에
// 로컬 객체를 통째로 담는다(mergeCars/ClientsFromRows가 raw.* 를 읽는다).

/**
 * @param {Array<import('../domain/financeTypes.ts').CarLike>} cars
 * @returns {Array<import('../data/store/atomicPersist.ts').JsonValue>}
 */
export function vehicleRowsFor(cars) {
  /** @type {Array<import('../data/store/atomicPersist.ts').JsonValue>} */
  const rows = []
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

/**
 * @param {Array<import('../domain/clientTypes.ts').ClientLike>} clients
 * @returns {Array<import('../data/store/atomicPersist.ts').JsonValue>}
 */
export function clientRowsFor(clients) {
  /** @type {Array<import('../data/store/atomicPersist.ts').JsonValue>} */
  const rows = []
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
