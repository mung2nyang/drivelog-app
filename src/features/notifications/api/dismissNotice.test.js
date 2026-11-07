// @ts-check
// 알림 [닫기]: 문의 답변 알림은 서버에 봤음 저장 성공 뒤에만 기기 목록에 넣고, 실패면 던지고 그대로 둔다.
import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'

/** @type {Array<[string, string]>} */
const marked = []
/** @type {Array<[string, string]>} */
const dismissed = []
let failMark = false

mock.module('../../../data/cloud/inquiryNotices.ts', {
  namedExports: {
    markInquiryAnswerSeen: async (/** @type {string} */ id, /** @type {string} */ at) => {
      marked.push([id, at])
      if (failMark) throw new Error('x')
    },
  },
})
mock.module('./notifications.js', {
  namedExports: { dismissNotification: (/** @type {string} */ owner, /** @type {string} */ id) => { dismissed.push([owner, id]) } },
})

const { dismissNotice } = await import('./dismissNotice.ts')

beforeEach(() => { marked.length = 0; dismissed.length = 0; failMark = false })

const ANSWER = { id: 'inquiryAnswer:q-1:2026-11-06T15:42:16Z', kind: 'inquiryAnswer', inquiryId: 'q-1', answeredAt: '2026-11-06T15:42:16Z' }

test('답변 알림: 서버에 봤음 저장(문의 id·답변 시각) 뒤 기기 목록에도 넣는다', async () => {
  await dismissNotice('owner-1', ANSWER)
  assert.deepEqual(marked, [['q-1', '2026-11-06T15:42:16Z']])
  assert.deepEqual(dismissed, [['owner-1', ANSWER.id]])
})

test('답변 알림: 서버 저장이 실패하면 던지고 기기 목록은 그대로', async () => {
  failMark = true
  await assert.rejects(dismissNotice('owner-1', ANSWER))
  assert.deepEqual(dismissed, [])
})

test('다른 알림: 서버에 묻지 않고 기기 목록에만 넣는다', async () => {
  await dismissNotice('owner-1', { id: 'overdue:x', kind: 'overdue' })
  assert.deepEqual(marked, [])
  assert.deepEqual(dismissed, [['owner-1', 'overdue:x']])
})
