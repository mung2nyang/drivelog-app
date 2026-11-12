// @ts-check
// 알림 [닫기]: 계정 설정 닫은 목록에 저장(이 휴대폰 옛 목록도 같이), 문의 답변은 서버 봤음 먼저, 어느 저장이든 실패하면 던지고 그대로. 읽기는 두 목록을 합친다.
import '../../../testSupport/stubSupabaseClient.ts'
import '../../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'

/** @type {Array<[string, string]>} */
const marked = []
const fail = { mark: false, save: false }

mock.module('../../../data/cloud/inquiryNotices.ts', {
  namedExports: {
    markInquiryAnswerSeen: async (/** @type {string} */ id, /** @type {string} */ at) => {
      marked.push([id, at])
      if (fail.mark) throw new Error('x')
    },
  },
})

const { commitDismissedNotifications, commitSettings } = await import('../../../data/store/commitHelpers.ts')
const { readOwnerSettings } = await import('../../../data/store/ownerDataHooks.ts')
const { normalizeSettings } = await import('../../../domain/practiceSettings.ts')
mock.module('../../../data/sync/settingsSave.ts', {
  namedExports: {
    savePracticeSettings: async (/** @type {string} */ ownerKey, /** @type {(current: object) => object} */ patch) => {
      if (fail.save) throw new Error('저장 실패 흉내')
      const current = readOwnerSettings(ownerKey)
      const next = normalizeSettings({ ...current, ...patch(current) })
      commitSettings(ownerKey, next)
      return next
    },
  },
})

const { dismissNotice, readDismissedIds } = await import('./dismissNotice.ts')
const { todayKey } = await import('../../../domain/expenses.ts')

beforeEach(() => {
  marked.length = 0
  fail.mark = false
  fail.save = false
  localStorage.clear()
})

/** @param {string} ownerKey */
const accountIds = (ownerKey) => readOwnerSettings(ownerKey).dismissedNotices || []

const ANSWER = { id: 'inquiryAnswer:q-1:2026-11-06T15:42:16Z', kind: 'inquiryAnswer', inquiryId: 'q-1', answeredAt: '2026-11-06T15:42:16Z' }

test('다른 알림: 서버 봤음은 묻지 않고 계정 설정 닫은 목록에 넣는다(이 휴대폰 목록에는 안 씀)', async () => {
  commitSettings('dn-1', normalizeSettings({}))
  await dismissNotice('dn-1', { id: 'overdue:x', kind: 'overdue' })
  assert.deepEqual(marked, [])
  assert.deepEqual(accountIds('dn-1'), ['overdue:x'])
  assert.equal(localStorage.getItem('reactPracticeDismissedNotifs:dn-1'), null, '이 휴대폰 목록 그대로')
})

test('이 휴대폰 옛 닫은 목록도 같이 계정에 올린다(지난 날짜 "오늘 일지 없음"은 빼고)', async () => {
  commitSettings('dn-2', normalizeSettings({ dismissedNotices: ['driver:d1'] }))
  commitDismissedNotifications('dn-2', ['driver:d0', 'today:2020-01-01', `today:${todayKey()}`])
  await dismissNotice('dn-2', { id: 'adminInquiry:q9', kind: 'adminInquiry' })
  assert.deepEqual(accountIds('dn-2'), ['driver:d1', 'driver:d0', `today:${todayKey()}`, 'adminInquiry:q9'])
})

test('답변 알림: 서버에 봤음 저장(문의 id·답변 시각) 뒤 계정 설정에도 넣는다', async () => {
  commitSettings('dn-3', normalizeSettings({}))
  await dismissNotice('dn-3', ANSWER)
  assert.deepEqual(marked, [['q-1', '2026-11-06T15:42:16Z']])
  assert.deepEqual(accountIds('dn-3'), [ANSWER.id])
})

test('답변 알림: 서버 봤음 저장이 실패하면 던지고 계정 설정은 그대로', async () => {
  commitSettings('dn-4', normalizeSettings({}))
  fail.mark = true
  await assert.rejects(dismissNotice('dn-4', ANSWER))
  assert.deepEqual(accountIds('dn-4'), [])
})

test('계정 설정 저장이 실패하면 던지고 그대로(알림이 남음)', async () => {
  commitSettings('dn-5', normalizeSettings({ dismissedNotices: ['driver:d1'] }))
  fail.save = true
  await assert.rejects(dismissNotice('dn-5', { id: 'overdue:y', kind: 'overdue' }))
  assert.deepEqual(accountIds('dn-5'), ['driver:d1'])
  assert.deepEqual(readDismissedIds('dn-5'), ['driver:d1'])
})

test('읽기: 계정 설정 목록과 이 휴대폰 옛 목록을 합친다(겹친 것은 한 번)', () => {
  commitSettings('dn-6', normalizeSettings({ dismissedNotices: ['driver:d1', 'overdue:a'] }))
  commitDismissedNotifications('dn-6', ['overdue:a', 'today:2026-11-08'])
  assert.deepEqual(readDismissedIds('dn-6'), ['driver:d1', 'overdue:a', 'today:2026-11-08'])
})
