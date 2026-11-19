import '../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

const { writeJsonKey, storageKeyFor } = await import('./persist.ts')
const { getState } = await import('./app-store.ts')
const { initializeOwnerFromPersist } = await import('./owner-state.ts')

function storedCars(owner) {
  return JSON.parse(localStorage.getItem(storageKeyFor('cars', owner)) || '[]')
}

describe('비회원 차량 예전 기본값 한 번 바꾸기', () => {
  test('처음 열 때 30.5·1.8을 49.9·1.76으로 바꿔 휴대폰에도 저장한다', () => {
    const owner = 'rate-guest-first'
    writeJsonKey('cars', owner, [{ id: 'c1', number: '11가1111', expenseRate: '30.5', insuranceRate: '1.8' }, { id: 'c2', number: '22가2222', expenseRate: '40' }])
    assert.equal(initializeOwnerFromPersist(owner), true)
    assert.equal(getState().cars[owner][0].expenseRate, '49.9')
    assert.equal(getState().cars[owner][0].insuranceRate, '1.76')
    assert.equal(getState().cars[owner][1].expenseRate, '40')
    assert.equal(storedCars(owner)[0].expenseRate, '49.9')
  })

  test('한 번 바꾼 뒤 차주가 넣은 30.5는 다시 열어도 그대로', () => {
    const owner = 'rate-guest-second'
    writeJsonKey('cars', owner, [{ id: 'c1', number: '11가1111', expenseRate: '30.5' }])
    initializeOwnerFromPersist(owner)
    writeJsonKey('cars', owner, [{ id: 'c1', number: '11가1111', expenseRate: '30.5' }])
    initializeOwnerFromPersist(owner)
    assert.equal(getState().cars[owner][0].expenseRate, '30.5')
    assert.equal(storedCars(owner)[0].expenseRate, '30.5')
  })
})
