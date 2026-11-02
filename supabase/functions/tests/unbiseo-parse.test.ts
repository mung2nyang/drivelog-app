// 운비서 말 읽기 서버 시험: AI 답 읽기 규칙과 날짜·달 표. CI에서 deno test로 돈다.
import assert from 'node:assert/strict'
import { readAiAnswer } from '../unbiseo-parse/answer.ts'
import { dateTable, monthTable } from '../unbiseo-parse/grok.ts'
import type { ParseInput } from '../unbiseo-parse/grok.ts'

const TODAY = '2026-11-02'

function input(text: string, more: Partial<ParseInput> = {}): ParseInput {
  return { text, today: TODAY, clientNames: ['CJ대한통운', '한진'], routeNames: ['평택 → 용인'], ...more }
}

function read(answer: object, text = '시험 문장', more: Partial<ParseInput> = {}) {
  return readAiAnswer(JSON.stringify(answer), input(text, more))
}

function callOf(answer: object, text = '시험 문장', more: Partial<ParseInput> = {}) {
  const parsed = read(answer, text, more)
  if (parsed?.kind !== 'call') throw new Error(`운행이 아님: ${JSON.stringify(parsed)}`)
  return parsed.call
}

function expenseOf(answer: object) {
  const parsed = read(answer)
  if (parsed?.kind !== 'expense') throw new Error(`지출이 아님: ${JSON.stringify(parsed)}`)
  return parsed.expense
}

function questionOf(answer: object) {
  const parsed = read(answer)
  if (parsed?.kind !== 'question') throw new Error(`질문이 아님: ${JSON.stringify(parsed)}`)
  return parsed.question
}

function clientOf(answer: object) {
  const parsed = read(answer)
  if (parsed?.kind !== 'client') throw new Error(`거래처 등록이 아님: ${JSON.stringify(parsed)}`)
  return parsed.client
}

const CALL = { kind: 'call', date: TODAY, loadLoc: '수원', unloadLoc: '화성', fare: 150000, client: null }
const EXPENSE = { kind: 'expense', date: TODAY, expenseType: 'fuel', cost: 120000, name: '경유', category: null, fuelType: '주유', payment: null }

Deno.test('모양: JSON이 아닌 답은 null', () => {
  assert.equal(readAiAnswer('운행입니다', input('시험')), null)
})

Deno.test('모양: 배열 답은 null', () => {
  assert.equal(readAiAnswer('[]', input('시험')), null)
})

Deno.test('모양: 모르는 종류는 null', () => {
  assert.equal(read({ kind: 'news' }), null)
})

Deno.test('운행: 칸을 그대로 읽음', () => {
  assert.deepEqual(read(CALL), { kind: 'call', call: { date: TODAY, loadLoc: '수원', unloadLoc: '화성', fare: 150000, client: '' } })
})

Deno.test('운행: 내일 날짜는 오늘로', () => {
  assert.equal(callOf({ ...CALL, date: '2026-11-03' }).date, TODAY)
})

Deno.test('운행: 없는 날짜는 오늘로', () => {
  assert.equal(callOf({ ...CALL, date: '2026-02-30' }).date, TODAY)
})

Deno.test('운행: 지난 날짜는 그대로', () => {
  assert.equal(callOf({ ...CALL, date: '2026-10-30' }).date, '2026-10-30')
})

Deno.test('운행: 운임은 0 이상 정수만', () => {
  assert.equal(callOf({ ...CALL, fare: -1000 }).fare, null)
  assert.equal(callOf({ ...CALL, fare: 1500.5 }).fare, null)
  assert.equal(callOf({ ...CALL, fare: '150000' }).fare, null)
  assert.equal(callOf({ ...CALL, fare: 0 }).fare, 0)
})

Deno.test('운행: 장소는 앞뒤 공백을 떼고 100자까지', () => {
  const call = callOf({ ...CALL, loadLoc: `  ${'가'.repeat(120)}  `, unloadLoc: 7 })
  assert.equal(call.loadLoc, '가'.repeat(100))
  assert.equal(call.unloadLoc, '')
})

Deno.test('운행: 거래처는 목록 이름과 같으면 목록 이름 그대로, 아니면 들은 그대로', () => {
  assert.equal(callOf({ ...CALL, client: ' 한진 ' }, '시험', { clientNames: [' 한진 '] }).client, ' 한진 ')
  assert.equal(callOf({ ...CALL, client: '씨제이' }).client, '씨제이')
})

Deno.test('지출: 칸을 그대로 읽음', () => {
  assert.deepEqual(read(EXPENSE), { kind: 'expense', expense: { date: TODAY, type: 'fuel', cost: 120000, name: '경유', category: '', fuelType: '주유', payment: '' } })
})

Deno.test('지출: 내일 날짜는 오늘로', () => {
  assert.equal(expenseOf({ ...EXPENSE, date: '2026-11-04' }).date, TODAY)
})

Deno.test('지출: 모르는 지출 종류는 정비로', () => {
  assert.equal(expenseOf({ ...EXPENSE, expenseType: 'tire' }).type, 'maint')
})

Deno.test('지출: 목록 밖 분류·결제는 빈 값', () => {
  const expense = expenseOf({ ...EXPENSE, expenseType: 'maint', category: '타이어', payment: '계좌' })
  assert.equal(expense.category, '')
  assert.equal(expense.payment, '')
  assert.equal(expenseOf({ ...EXPENSE, expenseType: 'misc', category: '통행료', payment: '현금' }).category, '통행료')
})

Deno.test('지출: 주유가 아니면 주유 종류는 빈 값', () => {
  assert.equal(expenseOf({ ...EXPENSE, expenseType: 'misc', fuelType: '주유' }).fuelType, '')
})

Deno.test('고정: 앞날은 오늘로, 노선은 등록 이름일 때만, 횟수는 1~20', () => {
  const fixed = read({ kind: 'fixed', date: '2026-11-05', fixedCount: 2, fixedRoute: '평택→용인' })
  assert.deepEqual(fixed, { kind: 'fixed', fixed: { date: TODAY, count: 2, route: '평택 → 용인' } })
  assert.deepEqual(read({ kind: 'fixed', date: TODAY, fixedCount: 21, fixedRoute: '서울 → 부산' }), { kind: 'fixed', fixed: { date: TODAY, count: 1, route: '' } })
})

Deno.test('거래처 등록: 이름이 있으면 거래처', () => {
  const client = clientOf({ kind: 'client', clientName: '한진', clientPhone: '010-1234-5678', paymentTerm: 'next_month_end' })
  assert.equal(client.name, '한진')
  assert.equal(client.phone, '010-1234-5678')
  assert.equal(client.paymentTerm, 'next_month_end')
})

Deno.test('거래처 등록: 이름이 없으면 관계없음', () => {
  assert.deepEqual(read({ kind: 'client', clientName: '  ', clientPhone: '01012345678' }), { kind: 'unknown' })
})

Deno.test('질문: 질문 종류·기간·거래처를 읽음', () => {
  assert.deepEqual(read({ kind: 'question', questionType: 'unpaid', periodUnit: null, periodValue: null, client: '한진' }), {
    kind: 'question',
    question: { type: 'unpaid', period: { unit: 'all' }, client: '한진', expenseType: '' },
  })
})

Deno.test('질문: 앞날 하루는 오늘로', () => {
  assert.deepEqual(questionOf({ kind: 'question', questionType: 'revenue', periodUnit: 'day', periodValue: '2026-11-03' }).period, { unit: 'day', value: TODAY })
})

Deno.test('문자: 말에 "문자"가 있으면 문자', () => {
  const answer = { kind: 'sms', smsClient: '한진', smsMonth: '2026-10', smsAll: null, smsTemplate: 1 }
  assert.deepEqual(read(answer, '한진에 10월분 미수금 문자'), { kind: 'sms', sms: { client: '한진', month: '2026-10', all: false, template: 1 } })
})

Deno.test('문자: 말에 "문자"가 없으면 관계없음', () => {
  assert.deepEqual(read({ kind: 'sms', smsClient: '한진' }, '한진 미수금 얼마 남았어'), { kind: 'unknown' })
})

Deno.test('날씨: 앞날은 그대로, 지역은 들은 그대로', () => {
  assert.deepEqual(read({ kind: 'weather', weatherDate: '2026-11-04', weatherPlace: ' 부산 강서구 ' }), { kind: 'weather', weather: { date: '2026-11-04', place: '부산 강서구' } })
})

Deno.test('날씨: 날짜가 없으면 오늘', () => {
  assert.deepEqual(read({ kind: 'weather', weatherDate: null, weatherPlace: null }), { kind: 'weather', weather: { date: TODAY, place: '' } })
})

Deno.test('점검표: 말에 "점검"이 있으면 점검표, 앞날은 오늘로', () => {
  assert.deepEqual(read({ kind: 'inspection', date: '2026-11-03' }, '내일 점검표 모두 양호'), { kind: 'inspection', inspection: { date: TODAY } })
})

Deno.test('점검표: 말에 "점검"이 없으면 관계없음', () => {
  assert.deepEqual(read({ kind: 'inspection', date: TODAY }, '오늘 모두 양호'), { kind: 'unknown' })
})

Deno.test('휴무: 앞날 그대로 휴무로', () => {
  assert.deepEqual(read({ kind: 'dayOff', date: '2026-11-03', dayOffCancel: false }, '내일 휴무'), { kind: 'dayOff', dayOff: { date: '2026-11-03', off: true } })
})

Deno.test('휴무: 취소하는 말이면 휴무 취소', () => {
  assert.deepEqual(read({ kind: 'dayOff', date: TODAY, dayOffCancel: true }, '오늘 휴무 취소'), { kind: 'dayOff', dayOff: { date: TODAY, off: false } })
})

Deno.test('휴무: "쉬"만 있어도 휴무, 없는 날짜는 오늘', () => {
  assert.deepEqual(read({ kind: 'dayOff', date: '2026-13-01', dayOffCancel: null }, '오늘 쉬어'), { kind: 'dayOff', dayOff: { date: TODAY, off: true } })
})

Deno.test('휴무: 말에 "휴무"나 "쉬"가 없으면 관계없음', () => {
  assert.deepEqual(read({ kind: 'dayOff', date: TODAY, dayOffCancel: false }, '휴게소에서 밥 먹었어'), { kind: 'unknown' })
})

Deno.test('관계없음: 그대로 관계없음', () => {
  assert.deepEqual(read({ kind: 'unknown' }), { kind: 'unknown' })
})

Deno.test('날짜 표: 오늘이 월요일이면 이번 주는 오늘부터 일요일까지', () => {
  const table = dateTable('2026-11-02')
  assert.match(table, /^오늘: 2026-11-02\(월\)$/m)
  assert.match(table, /^이번 주: 월 2026-11-02, 화 2026-11-03, 수 2026-11-04, 목 2026-11-05, 금 2026-11-06, 토 2026-11-07, 일 2026-11-08$/m)
  assert.match(table, /^지난주: 월 2026-10-26, .*, 일 2026-11-01$/m)
  assert.match(table, /^지난 ○요일\(오늘 전에 가장 가까운\): 일 2026-11-01, 월 2026-10-26, 화 2026-10-27, /m)
})

Deno.test('날짜 표: 오늘이 일요일이면 이번 주는 그 주 월요일부터', () => {
  const table = dateTable('2026-11-08')
  assert.match(table, /^오늘: 2026-11-08\(일\)$/m)
  assert.match(table, /^이번 주: 월 2026-11-02, .*, 일 2026-11-08$/m)
  assert.match(table, /^지난 ○요일\(오늘 전에 가장 가까운\): 일 2026-11-01, 월 2026-11-02, /m)
})

Deno.test('날짜 표: 3월 1일의 어제는 평년 2월 28일, 윤년 2월 29일', () => {
  assert.match(dateTable('2026-03-01'), /^어제: 2026-02-28\(토\)$/m)
  assert.match(dateTable('2028-03-01'), /^어제: 2028-02-29\(화\)$/m)
})

Deno.test('날짜 표: 내일·모레·글피는 달을 넘겨도 맞음', () => {
  const table = dateTable('2026-12-30')
  assert.match(table, /^내일: 2026-12-31\(목\)$/m)
  assert.match(table, /^모레: 2027-01-01\(금\)$/m)
  assert.match(table, /^글피: 2027-01-02\(토\)$/m)
})

Deno.test('달 표: 1월의 지난달은 작년 12월', () => {
  const table = monthTable('2027-01-15')
  assert.match(table, /^이번 달: 2027-01$/m)
  assert.match(table, /^지난달: 2026-12$/m)
  assert.match(table, /^작년: 2026$/m)
  assert.match(table, /^올해 달: 1월 2027-01, .*, 12월 2027-12$/m)
})
