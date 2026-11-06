// @ts-check
// 휴대폰 알림 계획 — 오늘 일지 오후 6시(오늘~7일 뒤, 기록 있는 날 빼기), 연체 미수금 다음 날 오전 9시(최대 20개), 비회원 백업 오후 8시, 끈 종류·닫은 알림·지난 시각 빼기.
import '../../../testSupport/stubSupabaseClient.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const { planDeviceNotices } = await import('./deviceNoticePlan.ts')

/** @typedef {import('./deviceNoticePlan.ts').DeviceNoticeInput} DeviceNoticeInput */

/** 2026-11-06(금) 오후 3시 기준. @param {Partial<DeviceNoticeInput>} [over] @returns {DeviceNoticeInput} */
function input(over = {}) {
  return {
    now: new Date(2026, 10, 6, 15, 0, 0),
    workDataByLogId: {},
    receivables: [],
    dismissed: [],
    off: [],
    guest: false,
    lastBackupAt: null,
    ...over,
  }
}

/** @param {string} client @param {string} due @param {string} [detailId] */
function receivable(client, due, detailId = 'd1') {
  return {
    dateKey: '2026-11-01', detailId, logId: 'main', logLabel: '', client, fare: 50000, paidAmount: 0, remainingAmount: 50000,
    paymentSummaryStatus: 'unpaid', payments: [], paymentDueDate: due, workDate: '2026-11-01', loadLoc: '', unloadLoc: '', remarks: '',
  }
}

/** @param {Date} date */
const stamp = (date) => `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}시`

test('오늘 일지: 오늘~7일 뒤 오후 6시, 기록·휴무가 있는 날과 닫은 날은 뺀다', () => {
  const plan = planDeviceNotices(input({
    workDataByLogId: { main: { '2026-11-07': { isOff: true }, '2026-11-09': { callDetails: [{ id: 'c' }] } } },
    dismissed: ['today:2026-11-10'],
  }))
  assert.deepEqual(plan.map((n) => stamp(n.at)), ['11/6 18시', '11/8 18시', '11/11 18시', '11/12 18시', '11/13 18시'])
  assert.equal(plan[0].key, 'today:2026-11-06')
  assert.equal(plan[0].page, 'home')
  assert.equal(plan[0].title, '오늘 작성한 운행일지가 없습니다')
})

test('오후 6시가 지난 뒤면 오늘 것은 안 건다(앱 안에 이미 있음)', () => {
  const plan = planDeviceNotices(input({ now: new Date(2026, 10, 6, 18, 30) }))
  assert.equal(plan[0].key, 'today:2026-11-07')
  assert.equal(plan.length, 7)
})

test('연체 미수금: 입금 예정일 다음 날 오전 9시, 이미 연체인 것·닫은 것은 빼고 가까운 순 20개', () => {
  const items = [receivable('나중', '2026-11-20'), receivable('이미 연체', '2026-11-04'), receivable('닫음', '2026-11-08', 'x')]
  for (let i = 0; i < 25; i += 1) items.push(receivable(`많음${i}`, '2026-12-01', `m${i}`))
  const plan = planDeviceNotices(input({ off: ['today'], receivables: items, dismissed: ['overdue:main:2026-11-01:x'] }))
  assert.equal(plan.length, 20)
  assert.equal(plan[0].title, '나중 연체 미수금')
  assert.equal(stamp(plan[0].at), '11/21 9시')
  assert.equal(plan[0].body, '50,000원, D+1 연체')
  assert.equal(plan[0].page, 'receivables')
  assert.ok(!plan.some((n) => n.title.startsWith('이미 연체') || n.title.startsWith('닫음')))
})

test('비회원 백업: 마지막 백업 뒤 14일째 오후 8시, 없으면 3일 뒤 오후 8시, 로그인이면 없음', () => {
  const off = ['today']
  const backed = planDeviceNotices(input({ off, guest: true, lastBackupAt: new Date(2026, 10, 1, 10).toISOString() }))
  assert.deepEqual(backed.map((n) => [n.title, stamp(n.at), n.page]), [['백업 권장', '11/15 20시', 'settings']])
  assert.match(backed[0].body, /14일이 지났습니다/)
  const never = planDeviceNotices(input({ off, guest: true }))
  assert.equal(stamp(never[0].at), '11/9 20시')
  assert.equal(never[0].key, 'backup:never')
  assert.deepEqual(planDeviceNotices(input({ off, guest: false })), [])
  assert.deepEqual(planDeviceNotices(input({ off, guest: true, dismissed: ['backup:never'] })), [])
  const old = planDeviceNotices(input({ off, guest: true, lastBackupAt: new Date(2026, 9, 1).toISOString() }))
  assert.deepEqual(old, [], '이미 14일이 지났으면 앱 안 알림이 있으니 안 건다')
})

test('"알림 받기"에서 끈 종류는 안 건다', () => {
  const plan = planDeviceNotices(input({ off: ['today', 'overdue', 'backup'], guest: true, receivables: [receivable('가', '2026-11-20')] }))
  assert.deepEqual(plan, [])
})
