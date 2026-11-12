// supabaseClient를 가져오는 순간 실제 createClient()가 돌아 Node 테스트 프로세스가 안 끝나므로
// (realtime/auth 타이머가 붙잡음), 다른 임포트보다 먼저 이 파일을 임포트해 아무것도 안 하는 스텁으로 바꾼다.
// --experimental-test-module-mocks 플래그가 있어야 동작한다(package.json의 test 스크립트).
import { mock } from 'node:test'
import type { JsonValue } from '../data/store/atomicPersist.ts'

export type StubQueryResult = { data: JsonValue, error: { message: string } | null }
export type StubMethod = 'select' | 'upsert' | 'insert' | 'update' | 'delete'

export const stubSupabaseCallCounts: Record<StubMethod, number> = { select: 0, upsert: 0, insert: 0, update: 0, delete: 0 }

function defaultMethodImpls(): Record<'select' | 'upsert' | 'insert' | 'update' | 'delete', () => Promise<StubQueryResult>> {
  return {
    select: async () => ({ data: [], error: null }),
    upsert: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null }),
    update: async () => ({ data: null, error: null }),
    delete: async () => ({ data: null, error: null }),
  }
}

export let stubSupabaseMethodImpls: ReturnType<typeof defaultMethodImpls> = defaultMethodImpls()

export function resetStubSupabaseCallCounts() {
  stubSupabaseCallCounts.select = 0
  stubSupabaseCallCounts.upsert = 0
  stubSupabaseCallCounts.insert = 0
  stubSupabaseCallCounts.update = 0
  stubSupabaseCallCounts.delete = 0
  stubSupabaseMethodImpls = defaultMethodImpls()
}

function bumpStubCall(method: StubMethod) {
  stubSupabaseCallCounts[method] += 1
}

function createQuery(method: 'select' | 'upsert' | 'insert' | 'update' | 'delete') {
  bumpStubCall(method)
  const query = {
    eq() { return query },
    in() { return query },
    order() { return query },
    range() { return query },
    select() { return query },
    single() { return query },
    maybeSingle() { return query },
    then(onFulfilled?: (value: StubQueryResult) => StubQueryResult, onRejected?: (reason: Error) => StubQueryResult) {
      return Promise.resolve(stubSupabaseMethodImpls[method]()).then(onFulfilled, onRejected)
    },
  }
  return query
}

mock.module('../data/cloud/supabaseClient.ts', {
  namedExports: {
    supabase: {
      from() {
        return {
          select: () => createQuery('select'),
          upsert: () => createQuery('upsert'),
          insert: () => createQuery('insert'),
          update: () => createQuery('update'),
          delete: () => createQuery('delete'),
        }
      },
      auth: { signOut: async () => ({ error: null }) },
    },
  },
})
