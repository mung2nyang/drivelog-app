// 플랫폼 칩 목록: 기본 6개, 정리(빈칸·겹침·9개), 맨 뒤에 더하기, 가득 차면 안내, 기본 칩도 지우기.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addPlatformPreset,
  normalizePlatformPresets,
  PLATFORM_PRESET_DEFAULTS,
  PLATFORM_PRESET_FULL,
  PLATFORM_PRESET_MAX,
  removePlatformPreset,
} from './platformPresets.ts'

const DEFAULTS = ['24시콜', '화물맨', '더운반', '원콜', '전국화물콜', '카카오T트럭커']

test('기본은 지금 화면의 6개(같은 순서), 최대 9개', () => {
  assert.deepEqual([...PLATFORM_PRESET_DEFAULTS], DEFAULTS)
  assert.equal(PLATFORM_PRESET_MAX, 9)
})

test('목록이 아니면 기본 6개, 목록이면 빈칸·빈 이름·겹침을 빼고 9개까지, 빈 목록은 빈 목록', () => {
  for (const value of [undefined, null, 'x', 3, {}]) assert.deepEqual(normalizePlatformPresets(/** @type {never} */ (value)), DEFAULTS, JSON.stringify(value))
  assert.deepEqual(normalizePlatformPresets([]), [])
  assert.deepEqual(normalizePlatformPresets([' 원콜 ', '', '원콜', 5, '  ', '내 플랫폼']), ['원콜', '내 플랫폼'])
  assert.deepEqual(normalizePlatformPresets(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']), ['1', '2', '3', '4', '5', '6', '7', '8', '9'])
})

test('더하기: 앞뒤 빈칸을 지워 맨 뒤에 붙이고, 빈 이름·이미 있는 이름은 그대로(안내 없음)', () => {
  const added = addPlatformPreset({}, '  내 플랫폼 ')
  assert.deepEqual(added.settings.platformPresets, [...DEFAULTS, '내 플랫폼'])
  assert.equal(added.error, undefined)
  for (const name of ['', '   ', '화물맨', ' 화물맨 ']) {
    const same = addPlatformPreset({ platformPresets: DEFAULTS }, name)
    assert.deepEqual(same.settings.platformPresets, DEFAULTS, name)
    assert.equal(same.error, undefined, name)
  }
})

test('더하기: 9개가 차 있으면 그대로 두고 안내 문구를 돌려준다', () => {
  const full = [...DEFAULTS, '가', '나', '다']
  const result = addPlatformPreset({ platformPresets: full }, '라')
  assert.deepEqual(result.settings.platformPresets, full)
  assert.equal(result.error, PLATFORM_PRESET_FULL)
  assert.equal(PLATFORM_PRESET_FULL, '플랫폼 칩은 최대 9개입니다. 칩을 길게 눌러 하나를 지워 주세요.')
})

test('지우기: 기본 칩도 지우고, 없는 이름은 그대로, 다 지우면 빈 목록', () => {
  assert.deepEqual(removePlatformPreset({}, '화물맨').settings.platformPresets, DEFAULTS.filter((name) => name !== '화물맨'))
  assert.deepEqual(removePlatformPreset({ platformPresets: ['원콜'] }, '없는 이름').settings.platformPresets, ['원콜'])
  assert.deepEqual(removePlatformPreset({ platformPresets: ['원콜'] }, ' 원콜 ').settings.platformPresets, [])
})
