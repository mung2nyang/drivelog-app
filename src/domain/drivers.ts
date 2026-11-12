import { generateLocalId } from './localId.ts'
import type { JsonValue } from './jsonTypes.ts'
import type { DriverRecord } from './driverTypes.ts'

export type CarRef = { number?: string, type?: string }
export type DriverDraft = Pick<DriverRecord, 'name' | 'phone' | 'inviteCode' | 'vehicleNumber' | 'startDate' | 'endDate'> & { assignmentStart?: string, assignmentEnd?: string }

const INVITE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const INVITE_CODE_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/

export function normalizeInviteCode(value: JsonValue | undefined) {
  return String(value || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
}

const INVITE_CODE_IN_TEXT = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}-?[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/

export function pickInviteCodeFromText(text: string) {
  const words = text.toUpperCase().replace(/[^0-9A-Z-]+/g, ' ').split(' ')
  const found = new Set(words.filter((word) => INVITE_CODE_IN_TEXT.test(word)).map((word) => word.replace('-', '')))
  return found.size === 1 ? [...found][0] : null
}

export function formatInviteCode(code: string | null | undefined) {
  const value = code || ''
  return INVITE_CODE_PATTERN.test(value) ? `${value.slice(0, 5)}-${value.slice(5)}` : value
}

export function generateInviteCode(items: Array<{ inviteCode?: string }> | null | undefined = []) {
  const used = new Set((items || []).map((item) => item.inviteCode))
  let code = ''
  do {
    code = ''
    while (code.length < 10) {
      for (const byte of globalThis.crypto.getRandomValues(new Uint8Array(16))) {
        if (byte < 248 && code.length < 10) code += INVITE_ALPHABET[byte % 31]
      }
    }
  } while (used.has(code))
  return code
}

export function countByStatus(items: Array<DriverRecord> | null | undefined) {
  const list = items || []
  return {
    linked: list.filter((item) => item.status === 'linked').length,
    pending: list.filter((item) => item.status !== 'linked').length,
  }
}

export type DriverField = 'name' | 'phone' | 'inviteCode' | 'vehicleNumber' | 'startDate' | 'endDate'

export function checkDriverDraft(draft: DriverDraft, { editingId = null, items = [], cars = [], required = false }: { editingId?: string | null, items?: Array<DriverRecord> | null, cars?: Array<CarRef> | null, required?: boolean } = {}): { field: DriverField, message: string } | null {
  const inviteCode = normalizeInviteCode(draft.inviteCode)
  const vehicleNumber = String(draft.vehicleNumber || '').trim()
  const startDate = String(draft.startDate || draft.assignmentStart || '').trim()
  const endDate = String(draft.endDate || draft.assignmentEnd || '').trim()
  if (!String(draft.name || '').trim()) return { field: 'name', message: '기사 이름을 입력해 주세요.' }
  if (String(draft.phone || '').replace(/\D/g, '').length < 10) return { field: 'phone', message: '전화번호를 입력해 주세요.' }
  const keptCode = Boolean(inviteCode) && Boolean(editingId)
    && (items || []).some((item) => item.id === editingId && item.inviteCode === inviteCode)
  if (!INVITE_CODE_PATTERN.test(inviteCode) && !keptCode) return { field: 'inviteCode', message: '[코드 생성]으로 초대 코드를 만들어 주세요.' }
  if (vehicleNumber && (cars || []).find((car) => car.number === vehicleNumber)?.type === 'main') {
    return { field: 'vehicleNumber', message: '메인 차량은 기사에게 배정할 수 없습니다. 기사 차량 번호를 입력해 주세요.' }
  }
  if (required && !vehicleNumber) return { field: 'vehicleNumber', message: '배정 차량을 입력해 주세요.' }
  if ((required || vehicleNumber) && !startDate) return { field: 'startDate', message: '계약 시작일을 선택해 주세요.' }
  if (endDate && startDate && endDate < startDate) return { field: 'endDate', message: '계약 종료일은 시작일 이후로 선택해 주세요.' }
  return null
}

export function upsertDriver(items: Array<DriverRecord>, draft: DriverDraft, editingId: string | null | undefined = null, cars: Array<CarRef> | null | undefined = []): { items: Array<DriverRecord>, error?: string, id?: string } {
  const name = String(draft.name || '').trim()
  const phone = String(draft.phone || '').trim()
  const inviteCode = normalizeInviteCode(draft.inviteCode)
  const vehicleNumber = String(draft.vehicleNumber || '').trim()
  const startDate = String(draft.startDate || draft.assignmentStart || '').trim()
  const endDate = String(draft.endDate || draft.assignmentEnd || '').trim()

  const problem = checkDriverDraft(draft, { editingId, items, cars })
  if (problem) return { error: problem.message, items }

  const list = [...(items || [])]
  const duplicate = list.some((item) => item.inviteCode === inviteCode && item.id !== editingId)
  if (duplicate) return { error: '이미 쓰인 초대 코드입니다.', items }

  if (vehicleNumber) {
    const taken = list.some((item) => (
      item.id !== editingId
      && String(item.status || '') !== 'disconnected'
      && String(item.vehicleNumber || '').trim() === vehicleNumber
    ))
    if (taken) return { error: '이미 다른 기사에게 배정된 차량입니다.', items }

    const cleanPhone = phone.replace(/\D/g, '')
    const driverBusy = list.some((item) => (
      item.id !== editingId
      && String(item.status || '') !== 'disconnected'
      && Boolean(String(item.vehicleNumber || '').trim())
      && String(item.phone || '').replace(/\D/g, '') === cleanPhone
    ))
    if (driverBusy) return { error: '이미 다른 차량에 배정된 기사입니다.', items }
  }

  const next = { name, phone, inviteCode, vehicleNumber, startDate, endDate }

  if (editingId) {
    const idx = list.findIndex((item) => item.id === editingId)
    if (idx < 0) return { error: '기사를 찾지 못했습니다.', items }
    list[idx] = { ...list[idx], ...next }
    return { items: list }
  }

  list.push({ id: generateLocalId('drv'), status: 'pending', ...next })
  return { items: list }
}

export function setDriverStatus(items: Array<DriverRecord>, id: string, status: 'pending' | 'linked'): Array<DriverRecord> {
  return (items || []).map((item) => (item.id === id ? { ...item, status } : item))
}

export function removeDriver(items: Array<DriverRecord>, id: string): Array<DriverRecord> {
  return (items || []).filter((item) => item.id !== id)
}

export function isDateWithinAssignment(dateKey: string, assignmentStart: string | null | undefined, assignmentEnd: string | null | undefined) {
  if (!assignmentStart) return true
  if (dateKey < assignmentStart) return false
  if (assignmentEnd && dateKey > assignmentEnd) return false
  return true
}

export function getAssignmentState(link: { assignmentStart?: string, assignmentEnd?: string, startDate?: string, endDate?: string } | null | undefined): { key: 'scheduled' | 'ended' | 'active', label: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startRaw = link?.assignmentStart || link?.startDate || ''
  const endRaw = link?.assignmentEnd || link?.endDate || ''
  const start = startRaw ? new Date(`${startRaw}T00:00:00`) : null
  const end = endRaw ? new Date(`${endRaw}T23:59:59`) : null
  if (start && start > today) return { key: 'scheduled', label: '배정 예정' }
  if (end && end < today) return { key: 'ended', label: '배정 종료' }
  return { key: 'active', label: '배정 중' }
}

function dayLabel(dateKey: string, baseKey: string): string {
  const [y, m, d] = dateKey.split('-')
  const md = `${Number(m)}월 ${Number(d)}일`
  return y === baseKey.slice(0, 4) ? md : `${y}년 ${md}`
}

export function assignmentPeriodNotice(dateKey: string, start: string | null | undefined, end: string | null | undefined): { title: string, body: string } | null {
  if (start && dateKey < start) return { title: '계약기간 전 날짜입니다.', body: `${dayLabel(start, dateKey)}부터 기록할 수 있습니다.` }
  if (end && dateKey > end) return { title: '계약기간이 끝난 날짜입니다.', body: `${dayLabel(end, dateKey)}까지 기록할 수 있습니다.` }
  return null
}
