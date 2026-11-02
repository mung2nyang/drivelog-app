// 운비서 날씨 서버 시험: 한국 날짜, 발표 시각 고르기, 그 날 예보 묶기. CI에서 deno test로 돈다.
import assert from 'node:assert/strict'
import { baseOf, kstDate, summarizeDay } from '../unbiseo-weather/kma.ts'
import type { Json } from '../unbiseo-weather/kma.ts'

const DAY = '2026-11-02'

function row(category: string, fcstValue: string, fcstDate = '20261102'): Json {
  return { category, fcstDate, fcstTime: '1200', fcstValue }
}

Deno.test('한국 날짜: UTC 14:59는 같은 날, 15:00은 다음 날', () => {
  assert.equal(kstDate(Date.parse('2026-11-01T14:59:00Z')), '2026-11-01')
  assert.equal(kstDate(Date.parse('2026-11-01T15:00:00Z')), '2026-11-02')
})

Deno.test('한국 날짜: 날 수만큼 옮김', () => {
  assert.equal(kstDate(Date.parse('2026-12-31T03:00:00Z'), 1), '2027-01-01')
  assert.equal(kstDate(Date.parse('2026-11-02T03:00:00Z'), -1), '2026-11-01')
})

Deno.test('발표: 한국 02:14는 전날 23시 발표', () => {
  assert.deepEqual(baseOf(Date.parse('2026-11-01T17:14:00Z')), { date: '20261101', time: '2300' })
})

Deno.test('발표: 한국 02:15는 그날 02시 발표', () => {
  assert.deepEqual(baseOf(Date.parse('2026-11-01T17:15:00Z')), { date: '20261102', time: '0200' })
})

Deno.test('발표: 한국 자정 직후도 전날 23시 발표', () => {
  assert.deepEqual(baseOf(Date.parse('2026-11-01T15:01:00Z')), { date: '20261101', time: '2300' })
})

Deno.test('묶기: 그 날 기온 줄이 없으면 null', () => {
  assert.equal(summarizeDay([row('TMP', '10', '20261103'), row('SKY', '1')], DAY), null)
})

Deno.test('묶기: 하늘·비눈·최저·최고·강수 확률', () => {
  const items = [row('TMP', '8'), row('TMP', '15'), row('TMN', '6.4'), row('TMX', '16.5'), row('SKY', '3'), row('PTY', '0'), row('PTY', '1'), row('POP', '30'), row('POP', '60')]
  assert.deepEqual(summarizeDay(items, DAY), { date: DAY, sky: 'mostlyCloudy', precip: 'rain', min: 6, max: 17, pop: 60 })
})

Deno.test('묶기: 최저·최고가 없으면 시간별 기온에서', () => {
  const items = [row('TMP', '7.6'), row('TMP', '12'), row('TMP', '3.2')]
  assert.deepEqual(summarizeDay(items, DAY), { date: DAY, sky: null, precip: 'none', min: 3, max: 12, pop: null })
})

Deno.test('묶기: -999 같은 값과 숫자 아닌 값은 버림', () => {
  const items = [row('TMP', '10'), row('TMP', '-999'), row('TMP', '강수없음'), row('TMN', '-999'), row('POP', '900')]
  assert.deepEqual(summarizeDay(items, DAY), { date: DAY, sky: null, precip: 'none', min: 10, max: 10, pop: null })
})

Deno.test('묶기: 하늘은 가장 많이 나온 코드, 같으면 더 흐린 쪽', () => {
  const most = [row('TMP', '10'), row('SKY', '1'), row('SKY', '1'), row('SKY', '4')]
  assert.equal(summarizeDay(most, DAY)?.sky, 'clear')
  const tie = [row('TMP', '10'), row('SKY', '1'), row('SKY', '4')]
  assert.equal(summarizeDay(tie, DAY)?.sky, 'cloudy')
})

Deno.test('묶기: 비눈 없음(0)만 있으면 없음, 다른 날 줄은 안 봄', () => {
  const items = [row('TMP', '10'), row('PTY', '0'), row('PTY', '0'), row('PTY', '3', '20261103')]
  assert.equal(summarizeDay(items, DAY)?.precip, 'none')
})
