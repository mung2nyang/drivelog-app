import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { isAlreadyInAppOnBoot } from './bootHomeGuard.ts'

describe('isAlreadyInAppOnBoot — 부트 복원 시 goHome() 생략 판단', () => {
  test('/app 및 그 하위 경로는 true', () => {
    assert.equal(isAlreadyInAppOnBoot('/app'), true)
    assert.equal(isAlreadyInAppOnBoot('/app/day/2026-08-06'), true)
    assert.equal(isAlreadyInAppOnBoot('/app/me/settings'), true)
  })

  test('/onboarding은 true', () => {
    assert.equal(isAlreadyInAppOnBoot('/onboarding'), true)
  })

  test('/auth 등 그 외 경로는 false — goHome()으로 /app을 새로 연다', () => {
    assert.equal(isAlreadyInAppOnBoot('/auth'), false)
    assert.equal(isAlreadyInAppOnBoot('/'), false)
  })

  test('접두어만 같고 세그먼트가 다른 경로는 false', () => {
    assert.equal(isAlreadyInAppOnBoot('/application'), false)
    assert.equal(isAlreadyInAppOnBoot('/app-old'), false)
    assert.equal(isAlreadyInAppOnBoot('/onboarding-old'), false)
  })
})
