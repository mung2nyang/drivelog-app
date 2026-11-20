// @ts-check
import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'
import { createFakeSupabase } from '../../testSupport/fakeSupabaseClient.ts'

const { fakeSupabase, handlers, callsOf, resetHandlers } = createFakeSupabase()
mock.module('./supabaseClient.ts', { namedExports: { supabase: fakeSupabase } })

const { registerPushDevice, unregisterPushDevice } = await import('./pushDevices.ts')

const ok = () => ({ data: null, error: null })

beforeEach(async () => {
  resetHandlers()
  handlers.rpc = { unregister_push_device: ok }
  await unregisterPushDevice()
  resetHandlers()
})

test('맡긴 주소가 없으면 서버를 부르지 않는다', async () => {
  handlers.rpc = { unregister_push_device: ok }
  await unregisterPushDevice()
  assert.equal(callsOf('rpc', 'unregister_push_device').length, 0)
})

test('맡긴 주소가 있으면 그 주소로 지우고, 끝난 뒤에는 다시 부르지 않는다', async () => {
  handlers.rpc = { register_push_device: ok, unregister_push_device: ok }
  await registerPushDevice('token-a')
  await unregisterPushDevice()
  assert.deepEqual(callsOf('rpc', 'unregister_push_device').map((call) => call.args), [[{ p_token: 'token-a' }]])
  await unregisterPushDevice()
  assert.equal(callsOf('rpc', 'unregister_push_device').length, 1)
})

test('맡기기에 실패한 주소는 기억하지 않는다', async () => {
  handlers.rpc = { register_push_device: () => ({ data: null, error: { message: 'x' } }), unregister_push_device: ok }
  await assert.rejects(registerPushDevice('token-b'), { message: 'x' })
  await unregisterPushDevice()
  assert.equal(callsOf('rpc', 'unregister_push_device').length, 0)
})

test('지우기가 실패해도 오류 없이 끝나고 주소는 비워진다', async () => {
  handlers.rpc = { register_push_device: ok, unregister_push_device: () => { throw new Error('network') } }
  await registerPushDevice('token-c')
  await unregisterPushDevice()
  await unregisterPushDevice()
  assert.equal(callsOf('rpc', 'unregister_push_device').length, 1)
})

test('서버 오류 답이 와도 오류 없이 끝난다', async () => {
  handlers.rpc = { register_push_device: ok, unregister_push_device: () => ({ data: null, error: { message: 'x' } }) }
  await registerPushDevice('token-d')
  await unregisterPushDevice()
  assert.equal(callsOf('rpc', 'unregister_push_device').length, 1)
})

test('3초 안에 답이 없으면 기다리지 않고 끝난다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  handlers.rpc = { register_push_device: ok, unregister_push_device: () => new Promise(() => {}) }
  await registerPushDevice('token-e')
  let done = false
  const pending = unregisterPushDevice().then(() => { done = true })
  await new Promise((resolve) => setImmediate(resolve))
  t.mock.timers.tick(2999)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(done, false)
  t.mock.timers.tick(1)
  await pending
  assert.equal(done, true)
})
