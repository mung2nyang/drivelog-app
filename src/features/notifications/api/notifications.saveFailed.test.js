import '../../../testSupport/stubSupabaseClient.ts'
import '../../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const { collectNotifications } = await import('./notifications.ts')
const { dismissNotice } = await import('./dismissNotice.ts')
const { addFailedDayLogDate } = await import('../../../data/sync/failedDayLogDates.ts')
const { commitSettings } = await import('../../../data/store/commitHelpers.ts')
const { normalizeSettings } = await import('../../../domain/practiceSettings.ts')

test('실패 날짜마다 알림(메인·기사 차량), 맨 앞·날짜 오래된 순, 그 날짜 일지 주소', () => {
  const ownerKey = 'nf-items'
  commitSettings(ownerKey, normalizeSettings({ dailyInspectionOn: false }))
  addFailedDayLogDate(ownerKey, 'main', '2026-10-22')
  addFailedDayLogDate(ownerKey, '34나5678', '2026-10-09')
  const items = collectNotifications(ownerKey)
  assert.deepEqual(items.slice(0, 2), [
    {
      id: 'saveFailed:34나5678:2026-10-09', kind: 'saveFailed', page: 'logs/34나5678/day/2026-10-09',
      title: '10월 9일 운행일지(5678)를 저장하지 못했습니다.', body: '일지를 확인한 후 저장이 안 된 내용이 있으면 다시 입력해 주세요.', dateLabel: '', noDismiss: true,
    },
    {
      id: 'saveFailed:main:2026-10-22', kind: 'saveFailed', page: 'day/2026-10-22',
      title: '10월 22일 운행일지를 저장하지 못했습니다.', body: '일지를 확인한 후 저장이 안 된 내용이 있으면 다시 입력해 주세요.', dateLabel: '', noDismiss: true,
    },
  ])
  assert.ok(items.slice(2).some((item) => item.kind === 'inspectionRequired'), '다른 알림은 그 뒤')
})

test('알림 받기에서 꺼도, 닫은 id에 있어도 빠지지 않는다', async () => {
  const ownerKey = 'nf-off'
  commitSettings(ownerKey, normalizeSettings({ dailyInspectionOn: true, notifOff: ['saveFailed', 'today'] }))
  addFailedDayLogDate(ownerKey, 'main', '2026-10-22')
  await dismissNotice(ownerKey, { id: 'saveFailed:main:2026-10-22', kind: 'saveFailed' })
  assert.deepEqual(collectNotifications(ownerKey).map((item) => item.id), ['saveFailed:main:2026-10-22'])
})

test('내용이 보관된 날은 "일지를 열면 …다시 저장합니다.", 날짜만 있는 날은 예전 문구', () => {
  const ownerKey = 'nf-patch'
  commitSettings(ownerKey, normalizeSettings({ dailyInspectionOn: false }))
  addFailedDayLogDate(ownerKey, 'main', '2026-11-05', { isOff: false, fixedCount: 1, palletCount: 0, callDetails: [], fixedRouteCounts: {} })
  addFailedDayLogDate(ownerKey, 'main', '2026-11-06')
  const items = collectNotifications(ownerKey).filter((item) => item.kind === 'saveFailed')
  assert.deepEqual(items.map((item) => [item.id, item.body]), [
    ['saveFailed:main:2026-11-05', '일지를 열면 저장하지 못한 내용을 불러와 다시 저장합니다.'],
    ['saveFailed:main:2026-11-06', '일지를 확인한 후 저장이 안 된 내용이 있으면 다시 입력해 주세요.'],
  ])
})
