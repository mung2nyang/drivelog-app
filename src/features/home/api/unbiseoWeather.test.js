// @ts-check
import assert from 'node:assert/strict'
import { afterEach, beforeEach, mock, test } from 'node:test'
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'

/** @typedef {import('../../../domain/jsonTypes.ts').JsonValue} JsonValue */
/** @type {Array<{ name: string, body: JsonValue }>} */
const calls = []
/** @type {() => Promise<{ data: JsonValue, error: Error|null }>} */
let reply = async () => ({ data: null, error: null })

mock.module('../../../data/cloud/supabaseClient.ts', {
  namedExports: {
    supabase: {
      functions: {
        /** @param {string} name @param {{ body: JsonValue }} options */
        invoke: async (name, options) => { calls.push({ name, body: options.body }); return reply() },
      },
    },
  },
})

const { requestWeatherSentence, describeWeather, weatherRangeSentence, weatherTip, WEATHER_PAST, WEATHER_TOO_FAR, NO_LOCATION } = await import('./unbiseoWeather.ts')
const { LOGIN_NEEDED, TRY_LATER } = await import('./unbiseoParse.ts')

const TODAY = '2026-10-24'
const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
/** @type {Array<{ enableHighAccuracy?: boolean, timeout?: number, maximumAge?: number }>} */
let asked = []

/** 가짜 휴대폰 위치 — 'ok'면 평택시청 근처 좌표, 그 밖은 실패 코드. @param {'ok'|'denied'|'timeout'|'none'} mode */
function fakeLocation(mode) {
  const geolocation = {
    /** @param {(position: { coords: { latitude: number, longitude: number } }) => void} ok @param {(error: { code: number }) => void} fail @param {{ enableHighAccuracy?: boolean, timeout?: number, maximumAge?: number }} options */
    getCurrentPosition(ok, fail, options) {
      asked.push(options)
      if (mode === 'ok') ok({ coords: { latitude: 36.9894388888888, longitude: 127.114655555555 } })
      else fail({ code: mode === 'denied' ? 1 : 3 })
    },
  }
  Object.defineProperty(globalThis, 'navigator', { value: mode === 'none' ? {} : { geolocation }, configurable: true })
}

beforeEach(() => { calls.length = 0; asked = []; reply = async () => ({ data: null, error: null }) })
afterEach(() => { if (original) Object.defineProperty(globalThis, 'navigator', original) })

const DAY = { date: TODAY, sky: 'cloudy', precip: 'rain', min: 18, max: 23, pop: 60 }

test('지난 날·모레 뒤는 위치도 서버도 쓰지 않고 바로 문장', async () => {
  fakeLocation('ok')
  assert.equal(await requestWeatherSentence({ date: '2026-10-23', place: '' }, TODAY), WEATHER_PAST)
  assert.equal(await requestWeatherSentence({ date: '2026-10-27', place: '평택' }, TODAY), WEATHER_TOO_FAR)
  assert.equal(WEATHER_PAST, '과거 날씨는 안내하지 않아요.')
  assert.equal(WEATHER_TOO_FAR, '날씨는 모레까지 확인할 수 있어요.')
  assert.equal(weatherRangeSentence('2026-10-26', TODAY), null, '모레는 됨')
  assert.equal(weatherRangeSentence('2027-01-01', '2026-12-31'), null, '해 바뀜 내일')
  assert.deepEqual(calls, [])
  assert.deepEqual(asked, [])
})

test('지역이 있으면 그 이름으로 — 위치를 묻지 않는다', async () => {
  fakeLocation('ok')
  reply = async () => ({ data: { kind: 'weather', weather: { ...DAY, date: '2026-10-25' } }, error: null })
  assert.equal(await requestWeatherSentence({ date: '2026-10-25', place: '평택' }, TODAY), '내일 평택 날씨는 흐리고 비, 최저 18도, 최고 23도, 비 올 확률 60%예요. 비가 오니 우산 챙기세요.')
  assert.deepEqual(calls, [{ name: 'unbiseo-weather', body: { date: '2026-10-25', place: '평택' } }])
  assert.deepEqual(asked, [])
})

test('지역이 없으면 휴대폰 위치 → 격자 번호만 보낸다(위도·경도 없음), 정확도 낮음·10초·10분 안 위치', async () => {
  fakeLocation('ok')
  reply = async () => ({ data: { kind: 'weather', weather: DAY }, error: null })
  assert.equal(await requestWeatherSentence({ date: TODAY, place: '' }, TODAY), '오늘 지금 있는 곳 날씨는 흐리고 비, 최저 18도, 최고 23도, 비 올 확률 60%예요. 비가 오니 우산 챙기세요.')
  assert.deepEqual(calls, [{ name: 'unbiseo-weather', body: { date: TODAY, nx: 62, ny: 114 } }])
  assert.doesNotMatch(JSON.stringify(calls), /36\.9|127\.1|lat|lon/)
  assert.deepEqual(asked, [{ enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }])
})

test('위치를 못 쓰면(거절·시간 넘김·지원 안 함) 서버를 부르지 않고 한 문구', async () => {
  for (const mode of /** @type {const} */ (['denied', 'timeout', 'none'])) {
    fakeLocation(mode)
    assert.equal(await requestWeatherSentence({ date: TODAY, place: '' }, TODAY), NO_LOCATION, mode)
  }
  assert.equal(NO_LOCATION, '위치 정보 사용을 허용하거나 지역명을 말해 주세요.')
  assert.deepEqual(calls, [])
})

test('서버 답: 찾지 못함·지난·범위 밖·로그인·한도 넘음·실패', async () => {
  fakeLocation('ok')
  const ask = (/** @type {string} */ place) => requestWeatherSentence({ date: TODAY, place }, TODAY)
  reply = async () => ({ data: { kind: 'noPlace' }, error: null })
  assert.equal(await ask('평택 송탄'), '평택 송탄 지역을 찾지 못했어요. 시, 군, 구 이름을 말해 주세요.')
  assert.equal(await ask('부산 강서구'), '부산 강서구 지역을 찾지 못했어요. 시, 군, 구 이름을 말해 주세요.')
  assert.equal(await ask(''), TRY_LATER, '격자로 물었는데 찾지 못함은 실패로')
  reply = async () => ({ data: { kind: 'past' }, error: null })
  assert.equal(await ask('평택'), WEATHER_PAST, '서버 날짜가 하루 앞서도')
  reply = async () => ({ data: { kind: 'tooFar' }, error: null })
  assert.equal(await ask('평택'), WEATHER_TOO_FAR)
  reply = async () => ({ data: null, error: new FunctionsHttpError(new Response('{}', { status: 401 })) })
  assert.equal(await ask('평택'), LOGIN_NEEDED)
  reply = async () => ({ data: null, error: new FunctionsHttpError(new Response(JSON.stringify({ error: 'x', limit: 20 }), { status: 429 })) })
  assert.equal(await ask('평택'), '오늘 운비서를 20번 모두 썼어요. 내일 다시 써 주세요.', '날씨 한도 넘음은 운비서 문구')
  reply = async () => ({ data: null, error: new FunctionsHttpError(new Response('{}', { status: 429 })) })
  assert.equal(await ask('평택'), '오늘 운비서를 모두 썼어요. 내일 다시 써 주세요.', '한도 숫자를 못 읽으면 숫자 없이')
  for (const status of [400, 503, 500]) {
    reply = async () => ({ data: null, error: new FunctionsHttpError(new Response('{}', { status })) })
    assert.equal(await ask('평택'), TRY_LATER, String(status))
  }
  reply = async () => ({ data: null, error: new FunctionsFetchError('x') })
  assert.equal(await ask('평택'), TRY_LATER)
  reply = async () => { throw new Error('x') }
  assert.equal(await ask('평택'), TRY_LATER)
  /** @type {Array<JsonValue>} */
  const odd = [null, 'weather', { kind: 'weather' }, { kind: 'weather', weather: [] }, { kind: 'rain' }]
  for (const data of odd) {
    reply = async () => ({ data, error: null })
    assert.equal(await ask('평택'), TRY_LATER, JSON.stringify(data))
  }
})

test('문장 모양: 하늘만·비눈만·기온 한쪽·빠진 칸은 뺀다, 받침에 따라 이에요·예요', () => {
  const at = (/** @type {object} */ day, place = '평택', date = TODAY) => describeWeather({ sky: null, precip: null, min: null, max: null, pop: null, ...day }, { date, place }, TODAY)
  assert.equal(at({ sky: 'clear', min: 3, max: 12, pop: 0 }), '오늘 평택 날씨는 맑음, 최저 3도, 최고 12도, 비 올 확률 0%예요. 쌀쌀해요.')
  assert.equal(at({ sky: 'mostlyCloudy', precip: 'shower', min: -2, max: 5 }, '평택', '2026-10-26'), '모레 평택 날씨는 구름 많고 소나기, 최저 -2도, 최고 5도예요. 추워요. 따뜻하게 입으세요. 비가 오니 우산 챙기세요.')
  assert.equal(at({ sky: 'clear', precip: 'snow' }), '오늘 평택 날씨는 맑고 눈이에요. 눈길 운전 조심하세요.')
  assert.equal(at({ sky: 'clear' }), '오늘 평택 날씨는 맑음이에요.')
  assert.equal(at({ precip: 'rainSnow', max: 4 }), '오늘 평택 날씨는 비나 눈, 최고 4도예요. 쌀쌀해요. 눈길 운전 조심하세요.')
  assert.equal(at({ min: 7 }), '오늘 평택 날씨는 최저 7도예요.')
  assert.equal(at({}), TRY_LATER, '아무 칸도 없으면')
})

test('서버 칸이 이상하면 그 칸만 뺀다', async () => {
  fakeLocation('ok')
  reply = async () => ({ data: { kind: 'weather', weather: { sky: 'sunny', precip: 'hail', min: '3', max: 9, pop: 140 } }, error: null })
  assert.equal(await requestWeatherSentence({ date: TODAY, place: '평택' }, TODAY), '오늘 평택 날씨는 최고 9도예요. 쌀쌀해요.')
})

test('한마디: 기온은 위에서 처음 맞는 하나, 경계값 0도·12도·28도·33도·차이 10도', () => {
  const tip = (/** @type {object} */ day) => weatherTip({ sky: null, precip: null, min: null, max: null, pop: 0, ...day })
  assert.equal(tip({ min: -10, max: -3 }), '매우 추워요. 따뜻하게 입으세요.')
  assert.equal(tip({ min: -9, max: -3 }), '추워요. 따뜻하게 입으세요.')
  assert.equal(tip({ min: 0, max: 30 }), '추워요. 따뜻하게 입으세요.', '추운 줄이 먼저')
  assert.equal(tip({ min: 1, max: 12 }), '쌀쌀해요.')
  assert.equal(tip({ min: 20, max: 33 }), '무척 더워요. 물 자주 드세요.')
  assert.equal(tip({ min: 20, max: 32 }), '더워요.')
  assert.equal(tip({ min: 20, max: 28 }), '더워요.')
  assert.equal(tip({ min: 13, max: 23 }), '아침저녁으로 쌀쌀해요.')
  assert.equal(tip({ min: 14, max: 23 }), '다니기 좋은 날씨예요.')
  assert.equal(tip({ max: 13 }), '', '최저를 모르면 좋은 날이라고 하지 않음')
})

test('한마디: 비·눈은 하나, 기온 말 뒤에, 비 올 확률 60%부터 우산', () => {
  const tip = (/** @type {object} */ day) => weatherTip({ sky: null, precip: null, min: 14, max: 23, pop: 0, ...day })
  assert.equal(tip({ precip: 'snow' }), '눈길 운전 조심하세요.')
  assert.equal(tip({ precip: 'rainSnow', min: -1 }), '추워요. 따뜻하게 입으세요. 눈길 운전 조심하세요.')
  assert.equal(tip({ precip: 'rain' }), '비가 오니 우산 챙기세요.')
  assert.equal(tip({ precip: 'shower', max: 30 }), '더워요. 비가 오니 우산 챙기세요.')
  assert.equal(tip({ pop: 60 }), '비가 올 수 있으니 우산 챙기세요.')
  assert.equal(tip({ pop: 59 }), '다니기 좋은 날씨예요.')
  assert.equal(tip({ pop: null }), '', '비 올 확률을 모르면 좋은 날이라고 하지 않음')
  assert.equal(tip({ min: null, max: null, pop: 70 }), '비가 올 수 있으니 우산 챙기세요.', '기온을 몰라도 비 말은')
})

test('한마디: 좋은 날 문장 전체, 칸이 하나도 없으면 한마디 없이 실패 문구', () => {
  assert.equal(describeWeather({ sky: 'clear', precip: null, min: 14, max: 23, pop: 10 }, { date: TODAY, place: '평택' }, TODAY), '오늘 평택 날씨는 맑음, 최저 14도, 최고 23도, 비 올 확률 10%예요. 다니기 좋은 날씨예요.')
  assert.equal(describeWeather({ sky: null, precip: null, min: null, max: null, pop: null }, { date: TODAY, place: '평택' }, TODAY), TRY_LATER)
})
