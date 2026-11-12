import assert from 'node:assert/strict'
import { baseOf, kstDate, summarizeDay } from '../unbiseo-weather/kma.ts'
import type { Json } from '../unbiseo-weather/kma.ts'
import { gridOf, readInput } from '../unbiseo-weather/handler.ts'

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

Deno.test('받기: 지역 이름만 받음(앞뒤 공백 뗌)', () => {
  assert.deepEqual(readInput({ date: DAY, place: ' 평택 ' }), { date: DAY, place: '평택', grid: null })
})

Deno.test('받기: 격자 번호만 받음', () => {
  assert.deepEqual(readInput({ date: DAY, nx: 62, ny: 114 }), { date: DAY, place: '', grid: { nx: 62, ny: 114 } })
  assert.deepEqual(readInput({ date: DAY, nx: 149, ny: 253 })?.grid, { nx: 149, ny: 253 })
})

Deno.test('받기: 지역과 격자를 같이 보내거나 둘 다 없으면 거절', () => {
  assert.equal(readInput({ date: DAY, place: '평택', nx: 62, ny: 114 }), null)
  assert.equal(readInput({ date: DAY, place: '평택', nx: 62 }), null)
  assert.equal(readInput({ date: DAY }), null)
  assert.equal(readInput({ date: DAY, nx: 62 }), null)
})

Deno.test('받기: 격자 범위 밖·정수 아님은 거절', () => {
  assert.equal(readInput({ date: DAY, nx: 0, ny: 114 }), null)
  assert.equal(readInput({ date: DAY, nx: 150, ny: 114 }), null)
  assert.equal(readInput({ date: DAY, nx: 62, ny: 254 }), null)
  assert.equal(readInput({ date: DAY, nx: 62.5, ny: 114 }), null)
})

Deno.test('받기: 31자 지역·없는 날짜·객체 아님은 거절', () => {
  assert.equal(readInput({ date: DAY, place: '가'.repeat(31) }), null)
  assert.equal(readInput({ date: '2026-11-31', place: '평택' }), null)
  assert.equal(readInput([{ date: DAY, place: '평택' }]), null)
})

Deno.test('지역 찾기: 줄인 이름·정식 이름', () => {
  assert.deepEqual(gridOf('평택'), { nx: 62, ny: 114 })
  assert.deepEqual(gridOf('경기도 평택시'), { nx: 62, ny: 114 })
})

Deno.test('지역 찾기: 시·도와 구는 띄어 써도 찾음', () => {
  assert.deepEqual(gridOf('서울 강남구'), { nx: 61, ny: 126 })
  assert.deepEqual(gridOf('부산 중구'), { nx: 97, ny: 74 })
})

Deno.test('지역 찾기: 한 시의 일반구들은 첫 구', () => {
  assert.deepEqual(gridOf('수원'), { nx: 60, ny: 121 })
})

Deno.test('지역 찾기: 시·도만 말하면 시·도', () => {
  assert.deepEqual(gridOf('서울'), { nx: 60, ny: 127 })
})

Deno.test('지역 찾기: 여러 곳에 있는 이름·표에 없는 이름은 못 찾음', () => {
  assert.equal(gridOf('중구'), null)
  assert.equal(gridOf('없는동네'), null)
})
