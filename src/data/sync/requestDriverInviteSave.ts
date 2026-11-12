import type { DriverRecord } from '../../domain/driverTypes.ts'
import type { CarRecord, DriverLinkRow, SessionCapture } from './syncTypes.ts'
import { assertCloudWriteReady, assertSessionStillCurrent, captureSession, getCloudUserId } from '../cloud/cloudSession.ts'
import { commitCars, commitDrivers } from '../store/commitHelpers.ts'
import { readOwnerCars } from '../store/ownerDataHooks.ts'
import { runOwnerSaveSerialized } from './ownerSaveQueue.ts'
import { upsertVehicleFromList } from './syncVehiclesClients.ts'
import { StaleSessionError } from './saveErrors.ts'
import {
  driverLinkRowNeedsUpdate,
  updateDriverLinkFields,
  upsertDriverLinkViaRpc,
} from './driverLinkRpc.ts'
import { SERVER_SAVE_FAIL, SESSION_CHANGED_FAIL } from '../../shared/utils/failureMessages.ts'

const SAVE_FAIL_TOAST = SERVER_SAVE_FAIL
const SESSION_CHANGED_MESSAGE = SESSION_CHANGED_FAIL
const MISSING_CAR_MESSAGE = '배정 차량을 입력해 주세요.'
const MISSING_START_MESSAGE = '계약 시작일을 선택해 주세요.'
const UNKNOWN_CAR_MESSAGE = '등록된 기사 차량 번호를 입력해 주세요.'
const UNSYNCED_CAR_MESSAGE = '선택한 차량이 아직 저장되지 않았습니다. 잠시 후 다시 시도해 주세요.'
const CAR_DRIVER_FAIL_MESSAGE = '초대는 저장했지만 차량의 기사 이름과 전화번호는 저장하지 못했습니다. 잠시 후 다시 저장해 주세요.'

function applyServerRow(items: Array<DriverRecord>, idx: number, row: DriverLinkRow): Array<DriverRecord> {
  return items.map((item, i) => (i === idx
    ? { ...item, supabaseId: row.id, inviteCode: row.invite_code || item.inviteCode }
    : item))
}

function saveCarDriverInfo(ownerKey: string, carId: string, driver: DriverRecord, captured: SessionCapture): Promise<boolean> {
  const name = driver.name || ''
  const phone = driver.phone || ''
  return runOwnerSaveSerialized(ownerKey, async () => {
    const cars = readOwnerCars(ownerKey)
    const current = cars.find((item) => item.id === carId)
    if (!current || ((current.driverName || '') === name && (current.driverPhone || '') === phone)) return true
    const nextCars = cars.map((item) => (item.id === carId ? { ...item, driverName: name, driverPhone: phone } : item))
    try {
      await upsertVehicleFromList((getCloudUserId()) as string, ownerKey, nextCars, carId, captured)
      assertSessionStillCurrent(captured)
      commitCars(ownerKey, nextCars)
      return true
    } catch (error) {
      console.error('[requestDriverInviteSave] 차량 기사 정보 저장 실패:', error)
      return false
    }
  })
}

export async function requestDriverInviteSave({ ownerKey, items, editingId, cars }: { ownerKey: string, userId?: string, items: Array<DriverRecord>, editingId: string | null,
  cars?: Array<CarRecord>, previousItems?: Array<DriverRecord> }): Promise<{ items: Array<DriverRecord>, blocked: string | null, toast: string | null }> {
  const foundIdx = items.findIndex((item) => item.id === editingId)
  const idx = foundIdx >= 0 ? foundIdx : items.length - 1
  const driver = items[idx]

  if (!driver?.vehicleNumber || !driver.startDate) {
    const missing = driver?.vehicleNumber ? MISSING_START_MESSAGE : MISSING_CAR_MESSAGE
    return { items, blocked: missing, toast: missing }
  }

  let blocked: string | null = null
  try { assertCloudWriteReady() } catch (error) { blocked = error instanceof Error ? error.message : String(error) }
  if (blocked) return { items, blocked, toast: blocked }

  const car = (cars || []).find((item) => item.number === driver.vehicleNumber)
  if (!car) return { items, blocked: UNKNOWN_CAR_MESSAGE, toast: UNKNOWN_CAR_MESSAGE }
  if (!car.supabaseId) return { items, blocked: UNSYNCED_CAR_MESSAGE, toast: UNSYNCED_CAR_MESSAGE }

  const vehicleId = String(car.supabaseId)
  const inviteCode = driver.inviteCode || ''
  const assignmentStart = driver.startDate
  const assignmentEnd = driver.endDate || null
  const captured = captureSession()

  try {
    let row: DriverLinkRow
    if (driver.supabaseId) {
      row = await updateDriverLinkFields({
        supabaseId: driver.supabaseId, vehicleId, inviteCode, assignmentStart, assignmentEnd,
      })
      assertSessionStillCurrent(captured)
    } else {
      row = await upsertDriverLinkViaRpc({
        idempotencyKey: driver.id, vehicleId, inviteCode, assignmentStart, assignmentEnd,
      })
      assertSessionStillCurrent(captured)
      if (driverLinkRowNeedsUpdate(row, { inviteCode, assignmentStart, assignmentEnd })) {
        row = await updateDriverLinkFields({
          supabaseId: row.id, vehicleId, inviteCode, assignmentStart, assignmentEnd,
        })
        assertSessionStillCurrent(captured)
      }
    }

    const nextItems = applyServerRow(items, idx, row)
    commitDrivers(ownerKey, nextItems)
    const carSaved = await saveCarDriverInfo(ownerKey, car.id, driver, captured)
    return {
      items: nextItems,
      blocked: null,
      toast: !carSaved ? CAR_DRIVER_FAIL_MESSAGE : editingId ? '기사 배정 정보를 수정했습니다.' : '기사 초대를 저장했습니다.',
    }
  } catch (error) {
    if (error instanceof StaleSessionError) {
      return { items, blocked: null, toast: SESSION_CHANGED_MESSAGE }
    }
    console.error('[requestDriverInviteSave] 저장 실패:', error)
    return { items, blocked: SAVE_FAIL_TOAST, toast: SAVE_FAIL_TOAST }
  }
}
