import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSmsHref } from './smsHref.ts'

const BODY = '안녕 테스트'

test('buildSmsHref: 기본 UA는 ?, iPhone·iPad UA는 &', () => {
  assert.equal(buildSmsHref('01012345678', BODY, 'Mozilla/5.0 (Linux; Android 14)'), `sms:01012345678?body=${encodeURIComponent(BODY)}`)
  assert.equal(buildSmsHref('01012345678', BODY, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), `sms:01012345678&body=${encodeURIComponent(BODY)}`)
  assert.equal(buildSmsHref('01012345678', BODY, 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), `sms:01012345678&body=${encodeURIComponent(BODY)}`)
})
