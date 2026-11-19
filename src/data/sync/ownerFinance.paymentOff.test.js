import '../../testSupport/stubSupabaseClient.ts'
import '../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const { commitCars, commitLogWorkData, commitSettings, commitWorkData } = await import('../store/commitHelpers.ts')
const { readOwnerWorkDataByLogId } = await import('../store/ownerDataHooks.ts')
const { normalizeSettings } = await import('../../domain/practiceSettings.ts')
const { getReceivableItems } = await import('../../domain/finance.ts')
const { buildFinanceSettings } = await import('./ownerFinance.ts')

const OWNER = 'payment-off-owner'
const SUB = '서울77가7777'

function seed() {
  commitCars(OWNER, [
    { id: 'main-1', type: 'main', number: '서울00가0000' },
    { id: 'sub-1', type: 'sub', number: SUB, logEnabled: true },
  ])
  commitWorkData(OWNER, { '2026-09-01': { callDetails: [{ id: 'm-1', client: 'A', fare: 100000, payments: [] }] } })
  commitLogWorkData(OWNER, SUB, { '2026-09-02': { callDetails: [{ id: 's-1', client: 'B', fare: 50000, payments: [] }] } })
}

test('결제/수금 끔이면 메인·기사 차량 미수금 0건, 켜면 둘 다 다시 셈', () => {
  seed()
  commitSettings(OWNER, normalizeSettings({ paymentOn: false }))
  const off = buildFinanceSettings(OWNER)
  assert.equal(off.paymentOn, false)
  assert.equal(off.subPaymentOn, false)
  assert.deepEqual(getReceivableItems(off, readOwnerWorkDataByLogId(OWNER)), [])

  commitSettings(OWNER, normalizeSettings({ paymentOn: true }))
  const on = buildFinanceSettings(OWNER)
  assert.equal(on.paymentOn, true)
  assert.equal(on.subPaymentOn, true)
  const items = getReceivableItems(on, readOwnerWorkDataByLogId(OWNER))
  assert.deepEqual(items.map((item) => [item.logId, item.remainingAmount]).sort(), [['main', 100000], [SUB, 50000]])
})

test('결제 설정이 비어 있으면(직원 기사 계정 등) 꺼짐으로 읽음', () => {
  seed()
  commitSettings(OWNER, normalizeSettings({}))
  const settings = buildFinanceSettings(OWNER)
  assert.equal(settings.paymentOn, false)
  assert.deepEqual(getReceivableItems(settings, readOwnerWorkDataByLogId(OWNER)), [])
})
