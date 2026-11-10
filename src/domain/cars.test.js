import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { MAX_DRIVER_CARS, canAddDriverCar, checkCarDraft, dedupeCarsById, defaultFuelTypeForLog, upsertCar, validateDriverLinkFields } from './cars.ts'

describe('차량 저장 — 기사명·정산·수수료', () => {
  test('차량번호 중복은 거절한다', () => {
    const first = upsertCar([], { number: '서울12가3456', type: 'main' })
    const dup = upsertCar(first.cars, { number: '서울12가3456', type: 'sub', driverName: '김기사', driverPhone: '010-1234-5678' })
    assert.equal(dup.error, '이미 등록된 차량번호입니다.')
  })

  test('수정 시 supabaseId와 폼에 없는 필드를 보존한다', () => {
    const created = upsertCar([], { number: '서울12가3456', type: 'sub', driverName: '김기사', driverPhone: '010-1234-5678' })
    created.cars[0].supabaseId = 'veh-1'
    created.cars[0].logEnabled = true
    created.cars[0].archived = false
    const edited = upsertCar(created.cars, {
      number: '서울12가9999',
      type: 'sub',
      driverName: '김기사',
      driverPhone: '010-1234-5678',
    }, created.cars[0].id)
    assert.equal(edited.error, undefined)
    assert.equal(edited.cars[0].supabaseId, 'veh-1')
    assert.equal(edited.cars[0].logEnabled, true)
    assert.equal(edited.cars[0].number, '서울12가9999')
  })

  test('기사차량 신규 등록 시 산재보험 토글을 저장한다', () => {
    const result = upsertCar([], {
      number: '서울12가3456',
      type: 'sub',
      driverName: '김기사',
      driverPhone: '010-1234-5678',
      insuranceOn: true,
    })
    assert.equal(result.error, undefined)
    assert.equal(result.cars[0].insuranceOn, true)
  })

  test('메인 차량은 draft에 insuranceOn을 넣어도 항상 false다', () => {
    const result = upsertCar([], { number: '11가1111', type: 'main', insuranceOn: true })
    assert.equal(result.error, undefined)
    assert.equal(result.cars[0].insuranceOn, false)
  })

  test('draft에 insuranceOn이 없으면 기본값은 false다', () => {
    const result = upsertCar([], { number: '서울12가3456', type: 'sub', driverName: '김기사', driverPhone: '010-1234-5678' })
    assert.equal(result.error, undefined)
    assert.equal(result.cars[0].insuranceOn, false)
  })

  test('수정 시 산재보험 토글을 끄면 저장값도 꺼진다', () => {
    const created = upsertCar([], {
      number: '서울12가3456',
      type: 'sub',
      driverName: '김기사',
      driverPhone: '010-1234-5678',
      insuranceOn: true,
    })
    const edited = upsertCar(created.cars, {
      number: '서울12가3456',
      type: 'sub',
      driverName: '김기사',
      driverPhone: '010-1234-5678',
      insuranceOn: false,
    }, created.cars[0].id)
    assert.equal(edited.error, undefined)
    assert.equal(edited.cars[0].insuranceOn, false)
  })
  test('메인 차량은 한 대만 등록할 수 있다', () => {
    const first = upsertCar([], { number: '11가1111', type: 'main' })
    const second = upsertCar(first.cars, { number: '22나2222', type: 'main' })
    assert.equal(second.error, '메인 차량이 이미 등록되어 있습니다.')
  })

  test('기사차량은 기사명과 연락처가 비어도 저장된다', () => {
    const result = upsertCar([], {
      number: '서울12가3456',
      type: 'sub',
      driverName: '',
      driverPhone: '',
    })
    assert.equal(result.error, undefined)
    assert.equal(result.cars[0].number, '서울12가3456')
    assert.equal(result.cars[0].driverName, '')
    assert.equal(result.cars[0].driverPhone, '')
  })

  test('전화번호를 입력했는데 형식이 틀리면 거절한다', () => {
    const result = upsertCar([], {
      number: '서울12가3456',
      type: 'sub',
      driverName: '',
      driverPhone: '010',
    })
    assert.equal(result.error, '연락처 형식을 확인해 주세요.')
  })

  test('이름·전화번호 둘 다 비우면 통과한다', () => {
    const result = upsertCar([], {
      number: '22나2222',
      tonnage: '5',
      type: 'sub',
    })
    assert.equal(result.error, undefined)
    assert.equal(result.cars.length, 1)
    assert.equal(result.cars[0].type, 'sub')
  })

  test('기사차량 월급제 정산 방식을 저장한다', () => {
    const result = upsertCar([], {
      number: '서울12가3456',
      type: 'sub',
      driverName: '김기사',
      driverPhone: '010-1234-5678',
      driverPayMode: 'salary',
      driverSalaryAmount: '2,000,000',
      commEnabled: true,
      commType: 'percent',
      commission: '15',
    })
    assert.equal(result.error, undefined)
    assert.equal(result.cars[0].driverName, '김기사')
    assert.equal(result.cars[0].driverPhone, '010-1234-5678')
    assert.equal(result.cars[0].driverPayMode, 'salary')
    assert.equal(result.cars[0].driverSalaryAmount, '2000000')
    assert.equal(result.cars[0].commEnabled, false)
    assert.equal(result.cars[0].commission, '')
  })

  test('매출제는 commEnabled 없이 %만 입력해도 수수료가 저장된다', () => {
    const result = upsertCar([], {
      number: '서울12가3456',
      type: 'sub',
      driverName: '김기사',
      driverPhone: '010-1234-5678',
      driverPayMode: 'revenue',
      commType: 'percent',
      commission: '15',
    })
    assert.equal(result.error, undefined)
    assert.equal(result.cars[0].commEnabled, true)
    assert.equal(result.cars[0].commission, '15')
  })

  test('옛 건당 값이 와도 비율로 저장한다', () => {
    const result = upsertCar([], { number: '서울12가3456', type: 'sub', driverPayMode: 'revenue', commType: 'direct', commission: '15' })
    assert.equal(result.error, undefined)
    assert.equal(result.cars[0].commType, 'percent')
  })

  test('월급제인데 급여액이 없으면 거절한다', () => {
    const result = upsertCar([], {
      number: '서울12가3456',
      type: 'sub',
      driverName: '김기사',
      driverPhone: '010-1234-5678',
      driverPayMode: 'salary',
      driverSalaryAmount: '',
    })
    assert.equal(result.error, '월급제는 급여 금액을 입력해 주세요.')
  })
})

describe('validateDriverLinkFields — 기사 연동 사전 검사', () => {
  test('이름·전화 정상이면 null', () => {
    assert.equal(validateDriverLinkFields('김기사', '010-1234-5678'), null)
  })

  test('이름만 없으면 거절한다', () => {
    assert.equal(
      validateDriverLinkFields('', '010-1234-5678'),
      '기사명을 입력해 주세요.',
    )
  })

  test('전화만 짧으면 거절한다', () => {
    assert.equal(
      validateDriverLinkFields('김기사', '010'),
      '연락처 형식을 확인해 주세요.',
    )
  })

  test('둘 다 없으면 거절한다', () => {
    assert.equal(
      validateDriverLinkFields('', ''),
      '기사명을 입력해 주세요.',
    )
  })
})

describe('checkCarDraft — 로드맵 82-B 어느 칸이 문제인지', () => {
  test('차량번호 → 기사 연락처 → 월급제 금액 순서로 첫 문제 칸', () => {
    assert.deepEqual(checkCarDraft({ number: '' }), { field: 'number', message: '차량번호를 입력해 주세요.' })
    assert.deepEqual(checkCarDraft({ number: '12가3456', type: 'sub', driverPhone: '010' }), { field: 'driverPhone', message: '연락처 형식을 확인해 주세요.' })
    assert.deepEqual(
      checkCarDraft({ number: '12가3456', type: 'sub', driverPayMode: 'salary', driverSalaryAmount: '' }),
      { field: 'driverSalaryAmount', message: '월급제는 급여 금액을 입력해 주세요.' },
    )
    assert.equal(checkCarDraft({ number: '12가3456', type: 'sub' }), null)
  })

  test('기사 연동이면 기사명·연락처를 먼저, 운행 일지 전용이면 비워도 된다', () => {
    assert.deepEqual(checkCarDraft({ number: '', type: 'sub' }, { linkRequired: true }), { field: 'driverName', message: '기사명을 입력해 주세요.' })
    assert.deepEqual(checkCarDraft({ number: '', type: 'sub', driverName: '김기사', driverPhone: '' }, { linkRequired: true }), { field: 'driverPhone', message: '연락처 형식을 확인해 주세요.' })
    assert.equal(checkCarDraft({ number: '12가3456', type: 'sub', driverName: '', driverPhone: '' }), null)
  })
})

describe('dedupeCarsById', () => {
  test('같은 id는 선두 한 건만 남긴다', () => {
    const id = 'car_1788141346245_c60pq4'
    const next = dedupeCarsById([
      { id, number: '11가1111', type: 'main' },
      { id, number: '11가1111', type: 'main' },
    ])
    assert.equal(next.length, 1)
    assert.equal(next[0].id, id)
  })
})

describe('기사 차량 대수 제한', () => {
  test('기사 차량이 3대 미만이면 더 추가할 수 있다 — 메인 차량은 세지 않는다', () => {
    const subs = (/** @type {number} */ n) => Array.from({ length: n }, (_, i) => ({ number: `${i}`, type: 'sub' }))
    assert.equal(canAddDriverCar(null), true)
    assert.equal(canAddDriverCar([{ number: 'm', type: 'main' }, ...subs(2)]), true)
    assert.equal(canAddDriverCar([{ number: 'm', type: 'main' }, ...subs(3)]), false)
    assert.equal(canAddDriverCar(subs(4)), false)
    assert.equal(MAX_DRIVER_CARS, 3)
  })
})

describe('차량 연료 종류', () => {
  test('고른 연료 종류를 저장하고, 비우거나 목록 밖 값이면 칸을 뺀다', () => {
    const created = upsertCar([], { number: '서울12가3456', type: 'main', fuelKind: '전기' })
    assert.equal(created.cars[0].fuelKind, '전기')
    const cleared = upsertCar(created.cars, { number: '서울12가3456', type: 'main', fuelKind: '' }, created.cars[0].id)
    assert.equal('fuelKind' in cleared.cars[0], false)
    assert.equal('fuelKind' in upsertCar([], { number: '1', type: 'main', fuelKind: '수소' }).cars[0], false)
    const changed = upsertCar(created.cars, { number: '서울12가3456', type: 'main', fuelKind: 'LPG' }, created.cars[0].id)
    assert.equal(changed.cars[0].fuelKind, 'LPG')
  })

  test('일지 차량이 전기차일 때만 주유 입력을 "전기"로 연다', () => {
    /** @type {Array<import('./financeTypes.ts').CarLike>} */
    const cars = [{ number: '11가1111', type: 'main', fuelKind: '경유' }, { number: '22나2222', type: 'sub', fuelKind: '전기' }]
    assert.equal(defaultFuelTypeForLog(cars, '22나2222'), '전기')
    assert.equal(defaultFuelTypeForLog(cars, 'main'), '주유')
    assert.equal(defaultFuelTypeForLog(cars, undefined), '주유')
    assert.equal(defaultFuelTypeForLog([{ number: '11가1111', type: 'main', fuelKind: '전기' }], 'main'), '전기')
    assert.equal(defaultFuelTypeForLog([{ number: '22나2222', type: 'sub' }], '22나2222'), '주유')
    assert.equal(defaultFuelTypeForLog(null, 'main'), '주유')
  })

  test('연동 기사는 메인 차량이 없으면 배정 차량을 메인 일지로 본다', () => {
    /** @type {Array<import('./financeTypes.ts').CarLike>} */
    const assigned = [{ number: '22나2222', type: 'sub', fuelKind: '전기' }]
    assert.equal(defaultFuelTypeForLog(assigned, 'main', true), '전기')
    assert.equal(defaultFuelTypeForLog(assigned, 'main', false), '주유')
  })
})
