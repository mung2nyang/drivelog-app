// @ts-check
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { logIdForCar, mergeVehicleDayLogsFromServer } from './hydrateVehicleDayLogs.ts'
import { dayLogVersion, setDayLogVersion } from '../sync/dayLogVersions.ts'

describe('logIdForCar', () => {
  test('main -> main, sub -> plate, empty -> null', () => {
    assert.equal(logIdForCar({ type: 'main', number: '11가1111' }), 'main')
    assert.equal(logIdForCar({ type: 'sub', number: '22나2222' }), '22나2222')
    assert.equal(logIdForCar({ type: 'sub', number: '' }), null)
    assert.equal(logIdForCar({ type: 'sub', number: 'main' }), null)
  })
})

describe('mergeVehicleDayLogsFromServer', () => {
  test('splits dailyRows into logId maps', async () => {
    const { workLogs } = await mergeVehicleDayLogsFromServer({
      cars: [
        { type: 'main', number: '11가1111', supabaseId: 1 },
        { type: 'sub', number: '22나2222', supabaseId: 2 },
      ],
      mainTombstoneKeys: [],
      fetchDaily: async (vehicleId) => ({
        data: vehicleId === 1
          ? [{ work_date: '2026-08-01', is_off: false, fixed_count: 1, raw: {} }]
          : [{ work_date: '2026-08-02', is_off: false, fixed_count: 4, raw: {} }],
        error: null,
      }),
      fetchTransport: async () => ({ data: [], error: null }),
      throwIfAnyHydrateError: () => {},
    })
    assert.equal(workLogs.main['2026-08-01']?.fixedCount, 1)
    assert.equal(workLogs['22나2222']['2026-08-02']?.fixedCount, 4)
  })

  test('main tombstone dates excluded only from main map', async () => {
    const { workLogs } = await mergeVehicleDayLogsFromServer({
      cars: [
        { type: 'main', number: '11가1111', supabaseId: 1 },
        { type: 'sub', number: '22나2222', supabaseId: 2 },
      ],
      mainTombstoneKeys: ['2026-08-01'],
      fetchDaily: async () => ({
        data: [{ work_date: '2026-08-01', is_off: false, fixed_count: 9, raw: {} }],
        error: null,
      }),
      fetchTransport: async () => ({ data: [], error: null }),
      throwIfAnyHydrateError: () => {},
    })
    assert.equal(workLogs.main['2026-08-01'], undefined)
    assert.equal(workLogs['22나2222']['2026-08-01']?.fixedCount, 9)
  })

  test('차량·날짜마다 서버 고친 시각을 기억하고, 그 차량의 옛 기억은 지운다', async () => {
    setDayLogVersion(3, '2026-07-31', 'old-gone')
    setDayLogVersion(4, '2026-07-31', 'other-car')
    await mergeVehicleDayLogsFromServer({
      cars: [{ type: 'main', number: '33다3333', supabaseId: 3 }],
      mainTombstoneKeys: [],
      fetchDaily: async () => ({
        data: [
          { work_date: '2026-08-01', is_off: false, fixed_count: 1, raw: {}, updated_at: '2026-08-01T10:00:00.123456+00:00' },
          { work_date: '2026-08-02', is_off: false, fixed_count: 1, raw: {} },
        ],
        error: null,
      }),
      fetchTransport: async () => ({ data: [], error: null }),
      throwIfAnyHydrateError: () => {},
    })
    assert.equal(dayLogVersion(3, '2026-08-01'), '2026-08-01T10:00:00.123456+00:00')
    assert.equal(dayLogVersion(3, '2026-08-02'), null, '시각 없는 줄은 모름')
    assert.equal(dayLogVersion(3, '2026-07-31'), null, '그 차량 옛 기억은 지움')
    assert.equal(dayLogVersion(4, '2026-07-31'), 'other-car', '다른 차량은 그대로')
  })
})
