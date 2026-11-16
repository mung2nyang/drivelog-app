// @ts-check
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

/** @type {Record<string, import('../../../domain/jsonTypes.ts').JsonValue>} */
let backup = {}
let marked = 0
/** @type {string[]} */
const savedNames = []
/** @type {Error|null} */
let saveError = null

mock.module('../../../data/sync/guestBackup.ts', {
  namedExports: {
    buildGuestBackupData: () => backup,
    markBackupDone: () => { marked += 1 },
  },
})
mock.module('../../../shared/utils/saveFile.ts', {
  namedExports: {
    saveFileToDevice: async (/** @type {Blob} */ _blob, /** @type {string} */ name) => {
      savedNames.push(name)
      if (saveError) throw saveError
      return ' 안내'
    },
  },
})

const { guestHasRecords, saveGuestBackupFile } = await import('./guestBackupFile.ts')

const EMPTY = { cars: [{ id: 'c', type: 'main', number: '12가3456' }], clients: [], expenses: [], invoices: [], settings: {}, workData: {}, workLogs: { main: {} } }

test('비회원 기록이 없으면(차량·설정만) 거짓', () => {
  backup = { ...EMPTY }
  assert.equal(guestHasRecords(), false)
  backup = {}
  assert.equal(guestHasRecords(), false)
})

test('운행일지 하루, 거래처, 지출, 세금계산서 중 하나만 있어도 참', () => {
  for (const extra of [
    { workLogs: { main: {}, '34나5678': { '2026-11-01': { fixedCount: 1 } } } },
    { clients: [{ id: 'cl-1' }] },
    { expenses: [{ id: 'e-1' }] },
    { invoices: [{ id: 'i-1' }] },
  ]) {
    backup = { ...EMPTY, ...extra }
    assert.equal(guestHasRecords(), true, JSON.stringify(extra))
  }
})

test('백업 파일 저장: 설정과 같은 파일 이름, 성공하면 마지막 백업 날짜를 남기고 안내를 돌려준다', async () => {
  backup = { ...EMPTY }
  marked = 0
  savedNames.length = 0
  saveError = null
  assert.equal(await saveGuestBackupFile(), ' 안내')
  assert.match(savedNames[0], /^운송내역_백업_\d{4}-\d{2}-\d{2}\.json$/)
  assert.equal(marked, 1)
})

test('백업 파일 저장이 실패하면 마지막 백업 날짜를 남기지 않고 실패를 넘긴다', async () => {
  marked = 0
  saveError = new Error('x')
  await assert.rejects(() => saveGuestBackupFile())
  assert.equal(marked, 0)
  saveError = null
})
