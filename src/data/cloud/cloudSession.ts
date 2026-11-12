import type { AppSession, SessionCapture } from '../sync/syncTypes.ts'
import { getState, setHydration } from '../store/app-store.ts'
import { evict } from './singleFlight.ts'
import { StaleSessionError } from '../sync/saveErrors.ts'
import { SESSION_CHANGED_FAIL } from '../../shared/utils/failureMessages.ts'

export type { AppSession, SessionCapture }

function hydrateSingleFlightKey(ownerKey: string) {
  return `hydrate:${ownerKey}`
}

let cloudUserId: string | null = null
let cloudOwnerKey: string | null = null
let sessionEpoch = 0

export function captureSession(): SessionCapture {
  return { userId: cloudUserId, ownerKey: cloudOwnerKey, epoch: sessionEpoch }
}

export function getCloudUserId() { return cloudUserId }
export function getCloudOwnerKey() { return cloudOwnerKey }
export function getSessionEpoch() { return sessionEpoch }

export function beginSessionEpoch(userId: string, ownerKey: string) {
  cloudUserId = userId
  cloudOwnerKey = ownerKey
  sessionEpoch += 1
  return sessionEpoch
}

export function isSessionStillCurrent(captured: SessionCapture): boolean {
  return (
    captured.epoch === sessionEpoch
    && captured.userId === cloudUserId
    && captured.ownerKey === cloudOwnerKey
    && cloudUserId != null
    && cloudOwnerKey != null
  )
}

export function assertSessionStillCurrent(captured: SessionCapture) {
  if (!isSessionStillCurrent(captured)) {
    throw new StaleSessionError()
  }
}

export function isHydrationReady() {
  return getState().hydration.status === 'ready'
}

export function isCloudSession(session: AppSession | null | undefined) {
  return !!(session?.userId && !session.guestMode)
}

export function endCloudSession() {
  const outgoingOwnerKey = cloudOwnerKey
  cloudUserId = null
  cloudOwnerKey = null
  sessionEpoch += 1
  setHydration({ status: 'idle', userId: null, ownerKey: null, epoch: 0 })
  if (outgoingOwnerKey) evict(hydrateSingleFlightKey(outgoingOwnerKey))
}

export function assertCloudWriteReady() {
  if (!cloudUserId || !cloudOwnerKey) throw new Error('로그인이 필요합니다.')
  if (!isHydrationReady()) throw new Error('아직 기록을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.')
}

export function blockedReasonForCloudWrite(cloudId: string | number | null | undefined): string | null {
  if (!cloudId) return null
  try {
    assertCloudWriteReady()
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export function blockedReasonForOwnerDataWrite(expected: { ownerKey?: string, userId?: string | null, sessionEpoch?: number } = {}) {
  if (!getCloudUserId()) return null
  try {
    assertCloudWriteReady()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  if (expected.ownerKey && getCloudOwnerKey() !== expected.ownerKey) {
    return SESSION_CHANGED_FAIL
  }
  if (expected.userId && getCloudUserId() !== expected.userId) {
    return SESSION_CHANGED_FAIL
  }
  if (expected.sessionEpoch != null && expected.sessionEpoch !== getSessionEpoch()) {
    return SESSION_CHANGED_FAIL
  }
  const hydration = getState().hydration
  if (expected.ownerKey && hydration.ownerKey && hydration.ownerKey !== expected.ownerKey) {
    return SESSION_CHANGED_FAIL
  }
  if (expected.userId && hydration.userId && hydration.userId !== expected.userId) {
    return SESSION_CHANGED_FAIL
  }
  return null
}
