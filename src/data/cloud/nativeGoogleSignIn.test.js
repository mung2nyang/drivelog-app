// 앱 안 구글 로그인(Capacitor C-2) — 앱이면 계정 선택 창 → Supabase 토큰 로그인, 웹이면 지금처럼 구글 화면으로.
import assert from 'node:assert/strict'
import '../../testSupport/setupDom.ts'
import { createHash } from 'node:crypto'
import { mock, test } from 'node:test'

let native = true
/** @type {{ result: object } | Error} */
let loginOutcome = { result: { responseType: 'online', idToken: 'google-id-token' } }
/** @type {object[]} */
let loginCalls = []
/** @type {object[]} */
let initCalls = []
/** @type {object[]} */
let idTokenCalls = []
/** @type {object[]} */
let oauthCalls = []
/** @type {{ message: string } | null} */
let idTokenError = null

mock.module('@capacitor/core', {
  namedExports: { Capacitor: { isNativePlatform: () => native } },
})
mock.module('@capgo/capacitor-social-login', {
  namedExports: {
    SocialLogin: {
      initialize: async (/** @type {object} */ options) => { initCalls.push(options) },
      login: async (/** @type {object} */ options) => {
        loginCalls.push(options)
        if (loginOutcome instanceof Error) throw loginOutcome
        return loginOutcome
      },
    },
  },
})
mock.module('@supabase/supabase-js', {
  namedExports: {
    createClient: () => ({
      auth: {
        signInWithIdToken: async (/** @type {object} */ args) => { idTokenCalls.push(args); return { data: {}, error: idTokenError } },
        signInWithOAuth: async (/** @type {object} */ args) => { oauthCalls.push(args); return { data: {}, error: null } },
      },
    }),
  },
})

const { signInWithGoogleNative, GOOGLE_WEB_CLIENT_ID, NATIVE_GOOGLE_FAILED } = await import('./nativeGoogleSignIn.ts')
const { supabase, signInWithGoogle } = await import('./supabaseClient.ts')

function reset() {
  native = true
  loginOutcome = { result: { responseType: 'online', idToken: 'google-id-token' } }
  loginCalls = []
  initCalls = []
  idTokenCalls = []
  oauthCalls = []
  idTokenError = null
}

test('앱: 구글에는 해시한 nonce, Supabase에는 원래 nonce와 토큰을 넘기고 성공하면 /auth를 다시 연다', async () => {
  reset()
  /** @type {string[]} */
  const opened = []
  const result = await signInWithGoogleNative(supabase.auth, (path) => { opened.push(path) })
  assert.deepEqual(result, { error: null })
  assert.deepEqual(initCalls, [{ google: { webClientId: GOOGLE_WEB_CLIENT_ID, mode: 'online' } }])
  assert.equal(loginCalls.length, 1)
  assert.equal(idTokenCalls.length, 1)
  const login = /** @type {{ provider: string, options: { nonce: string } }} */ (loginCalls[0])
  const signIn = /** @type {{ provider: string, token: string, nonce: string }} */ (idTokenCalls[0])
  assert.equal(login.provider, 'google')
  assert.equal(signIn.provider, 'google')
  assert.equal(signIn.token, 'google-id-token')
  assert.ok(signIn.nonce.length > 0)
  assert.notEqual(login.options.nonce, signIn.nonce)
  assert.equal(login.options.nonce, createHash('sha256').update(signIn.nonce).digest('hex'))
  assert.deepEqual(opened, ['/auth'])
})

test('앱: 계정 선택을 취소하면 안내 오류를 돌려주고 Supabase 로그인·페이지 이동을 하지 않는다', async () => {
  reset()
  loginOutcome = new Error('User cancelled')
  /** @type {string[]} */
  const opened = []
  const result = await signInWithGoogleNative(supabase.auth, (path) => { opened.push(path) })
  assert.deepEqual(result, { error: { message: NATIVE_GOOGLE_FAILED } })
  assert.equal(idTokenCalls.length, 0)
  assert.deepEqual(opened, [])
})

test('앱: 토큰이 없거나 Supabase 로그인이 실패하면 안내 오류를 돌려주고 페이지 이동을 하지 않는다', async () => {
  reset()
  loginOutcome = { result: { responseType: 'online', idToken: null } }
  /** @type {string[]} */
  const opened = []
  assert.deepEqual(await signInWithGoogleNative(supabase.auth, (path) => { opened.push(path) }), { error: { message: NATIVE_GOOGLE_FAILED } })
  assert.equal(idTokenCalls.length, 0)

  reset()
  idTokenError = { message: 'nonce mismatch' }
  assert.deepEqual(await signInWithGoogleNative(supabase.auth, (path) => { opened.push(path) }), { error: { message: NATIVE_GOOGLE_FAILED } })
  assert.equal(idTokenCalls.length, 1)
  assert.deepEqual(opened, [])
  assert.equal(NATIVE_GOOGLE_FAILED, '구글 로그인을 마치지 못했습니다. 다시 시도해 주세요.')
})

test('signInWithGoogle: 앱이면 계정 선택 창 경로를, 웹이면 지금처럼 구글 화면(signInWithOAuth)을 탄다', async () => {
  reset()
  loginOutcome = new Error('User cancelled')
  const appResult = await signInWithGoogle()
  assert.deepEqual(appResult, { error: { message: NATIVE_GOOGLE_FAILED } })
  assert.equal(loginCalls.length, 1)
  assert.equal(oauthCalls.length, 0)

  reset()
  native = false
  await signInWithGoogle()
  assert.equal(loginCalls.length, 0)
  assert.equal(initCalls.length, 0)
  assert.equal(oauthCalls.length, 1)
  assert.deepEqual(oauthCalls[0], {
    provider: 'google',
    options: { redirectTo: 'http://localhost/auth', queryParams: { prompt: 'select_account' } },
  })
})
