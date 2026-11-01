// 가짜 서버가 받은 호출을 순서대로·조건까지 적어 두는지, 기존 filters·countOf는 그대로인지.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFakeSupabase } from '../../testSupport/fakeSupabaseClient.js'

test('호출 기록: 표·동작·넘긴 값·붙인 조건이 부른 순서대로 남는다', async () => {
  const { fakeSupabase, calls, callsOf } = createFakeSupabase()
  await fakeSupabase.from('vehicles').select('id, number').in('id', [1, 2]).order('id', { ascending: true }).range(0, 999)
  await fakeSupabase.from('clients').update({ client_id: null }).eq('client_id', 7)
  await fakeSupabase.from('vehicles').delete().eq('id', 901).select('id')
  await fakeSupabase.from('fuel_records').upsert({ id: 'a' }, { onConflict: 'id' }).neq('id', 'b').limit(1).maybeSingle()

  assert.deepEqual(calls.map((call) => `${call.table}.${call.method}`), ['vehicles.select', 'clients.update', 'vehicles.delete', 'fuel_records.upsert'])
  assert.deepEqual(calls[0], { table: 'vehicles', method: 'select', args: ['id, number'], ops: [['in', 'id', [1, 2]], ['order', 'id', { ascending: true }], ['range', 0, 999]] })
  assert.deepEqual(calls[1], { table: 'clients', method: 'update', args: [{ client_id: null }], ops: [['eq', 'client_id', 7]] })
  assert.deepEqual(callsOf('vehicles', 'delete'), [{ table: 'vehicles', method: 'delete', args: [], ops: [['eq', 'id', 901], ['select', 'id']] }])
  assert.deepEqual(calls[3].args, [{ id: 'a' }, { onConflict: 'id' }])
  assert.deepEqual(calls[3].ops, [['neq', 'id', 'b'], ['limit', 1], ['maybeSingle']])
})

test('넘기지 않은 값은 기록에서 빠진다: select()·insert 한 개 인자·single()', async () => {
  const { fakeSupabase, calls } = createFakeSupabase()
  await fakeSupabase.from('profiles').select().eq('id', 'u1').single()
  await fakeSupabase.from('daily_logs').insert({ id: 1 })
  assert.deepEqual(calls[0], { table: 'profiles', method: 'select', args: [], ops: [['eq', 'id', 'u1'], ['single']] })
  assert.deepEqual(calls[1], { table: 'daily_logs', method: 'insert', args: [{ id: 1 }], ops: [] })
})

test('서버 함수(rpc) 호출도 이름·넘긴 값으로 남는다', async () => {
  const { fakeSupabase, handlers, callsOf, countOf } = createFakeSupabase()
  handlers.rpc = { accept_invite: () => ({ data: true, error: null }) }
  await fakeSupabase.rpc('accept_invite', { code: 'ABC' })
  assert.deepEqual(callsOf('rpc', 'accept_invite'), [{ table: 'rpc', method: 'accept_invite', args: [{ code: 'ABC' }], ops: [] }])
  assert.equal(countOf('rpc', 'accept_invite'), 1)
})

test('resetHandlers는 기록·횟수·응답을 모두 비운다', async () => {
  const { fakeSupabase, handlers, calls, resetHandlers, countOf } = createFakeSupabase()
  handlers.vehicles = { select: () => ({ data: [{ id: 1 }], error: null }) }
  await fakeSupabase.from('vehicles').select('id')
  resetHandlers()
  assert.equal(calls.length, 0)
  assert.equal(countOf('vehicles', 'select'), 0)
  assert.deepEqual(await fakeSupabase.from('vehicles').select('id'), { data: [], error: null })
})

test('기존 동작 그대로: 응답 함수가 eq·gte·lte·range 조건을 받고 update는 넘긴 줄도 받는다', async () => {
  const { fakeSupabase, handlers, countOf } = createFakeSupabase()
  /** @type {Array<import('../../testSupport/fakeSupabaseClient.js').EqFilters>} */
  const seen = []
  handlers.daily_logs = {
    select: (filters) => { seen.push(/** @type {import('../../testSupport/fakeSupabaseClient.js').EqFilters} */ (filters)); return { data: [], error: null } },
    update: (row, filters) => ({ data: [row, filters ?? null], error: null }),
  }
  await fakeSupabase.from('daily_logs').select('id').eq('owner_id', 'u1').gte('work_date', '2026-10-01').lte('work_date', '2026-10-31').range(0, 999)
  const updated = await fakeSupabase.from('daily_logs').update({ memo: 'x' }).eq('id', 3)
  assert.deepEqual(seen, [{ owner_id: 'u1', 'work_date>=': '2026-10-01', 'work_date<=': '2026-10-31', range: '0-999' }])
  assert.deepEqual(updated.data, [{ memo: 'x' }, { id: 3 }])
  assert.equal(countOf('daily_logs', 'select'), 1)
  assert.equal(countOf('daily_logs', 'update'), 1)
})
