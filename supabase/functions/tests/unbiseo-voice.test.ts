import assert from 'node:assert/strict'
import { readText } from '../unbiseo-voice/handler.ts'

Deno.test('받기: 문장 앞뒤 공백을 떼고 받음', () => {
  assert.equal(readText({ text: '  오늘 매출은 30만 원이에요. ' }), '오늘 매출은 30만 원이에요.')
})

Deno.test('받기: 300자는 받고 301자는 거절', () => {
  assert.equal(readText({ text: '가'.repeat(300) })?.length, 300)
  assert.equal(readText({ text: '가'.repeat(301) }), null)
})

Deno.test('받기: 빈 문장·글자 아님·객체 아님은 거절', () => {
  assert.equal(readText({ text: '   ' }), null)
  assert.equal(readText({ text: 5 }), null)
  assert.equal(readText({}), null)
  assert.equal(readText(['안녕하세요']), null)
  assert.equal(readText(null), null)
})
