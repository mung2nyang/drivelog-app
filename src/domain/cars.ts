import { driverFieldsFromDraft } from './carDriverFields.ts'
import type { JsonValue } from './jsonTypes.ts'
import type { CarLike, FinanceSettings } from './financeTypes.ts'
import type { CarUpsertDraft } from './carDriverFields.ts'

export function hasMainCar(cars: Array<CarLike> | null | undefined) {
  return (cars || []).some((car) => car.type === 'main')
}

export const MAX_DRIVER_CARS = 3
export const DRIVER_CAR_LIMIT_MESSAGE = `기사 차량은 연동, 미연동 합쳐 최대 ${MAX_DRIVER_CARS}대까지 등록할 수 있습니다.`

export function canAddDriverCar(cars: Array<CarLike> | null | undefined) {
  return (cars || []).filter((car) => car.type === 'sub').length < MAX_DRIVER_CARS
}

export const CAR_FUEL_KINDS = ['휘발유', '경유', '전기', 'LPG'] as const
export type CarFuelKind = typeof CAR_FUEL_KINDS[number]

export function isCarFuelKind(value: string | null | undefined): value is CarFuelKind {
  return CAR_FUEL_KINDS.some((kind) => kind === value)
}

export function defaultFuelTypeForLog(cars: Array<CarLike> | null | undefined, logId: string | undefined, isEmployedDriver = false) {
  const list = cars || []
  const key = String(logId || '').trim()
  const car = !key || key === 'main'
    ? list.find((item) => item.type === 'main') ?? (isEmployedDriver ? list[0] : undefined)
    : list.find((item) => item.number === key)
  return car?.fuelKind === '전기' ? '전기' : '주유'
}

export function dedupeCarsById<T extends { id?: string | number }>(cars: Array<T> | null | undefined): Array<T> {
  const seen = new Set<string>()
  const next: Array<T> = []
  ;(Array.isArray(cars) ? cars : []).forEach((car) => {
    if (!car || typeof car !== 'object') return
    const rawId = (car as { id?: JsonValue }).id
    const id = rawId == null || rawId === '' ? '' : String(rawId)
    if (id) {
      if (seen.has(id)) return
      seen.add(id)
      next.push(rawId === id ? car : ({ ...car, id }) as T)
    } else {
      next.push(car)
    }
  })
  return next
}

function checkDriverLink(name: string | undefined, phone: string | undefined): { field: 'driverName' | 'driverPhone', message: string } | null {
  if (!String(name || '').trim()) return { field: 'driverName', message: '기사명을 입력해 주세요.' }
  if (String(phone || '').replace(/\D/g, '').length < 10) return { field: 'driverPhone', message: '연락처 형식을 확인해 주세요.' }
  return null
}

export function checkCarDraft(draft: CarUpsertDraft, { linkRequired = false }: { linkRequired?: boolean } = {}): { field: 'driverName' | 'driverPhone' | 'number' | 'driverSalaryAmount', message: string } | null {
  const linkProblem = linkRequired ? checkDriverLink(draft.driverName, draft.driverPhone) : null
  if (linkProblem) return linkProblem
  if (!String(draft.number || '').trim()) return { field: 'number', message: '차량번호를 입력해 주세요.' }
  if (draft.type !== 'sub') return null
  const extra = driverFieldsFromDraft(draft, 'sub')
  if (extra.driverPhone && extra.driverPhone.replace(/\D/g, '').length < 10) return { field: 'driverPhone', message: '연락처 형식을 확인해 주세요.' }
  if (extra.driverPayMode === 'salary' && !(Number(extra.driverSalaryAmount) > 0)) {
    return { field: 'driverSalaryAmount', message: '월급제는 급여 금액을 입력해 주세요.' }
  }
  return null
}

export function upsertCar(cars: Array<CarLike> | null | undefined, draft: CarUpsertDraft, editingId?: string | null) {
  const problem = checkCarDraft(draft)
  if (problem) return { error: problem.message, cars }
  const number = String(draft.number || '').trim()
  const tonnage = String(draft.tonnage || '').trim()
  const type = draft.type === 'sub' ? 'sub' : 'main'
  const extra = driverFieldsFromDraft(draft, type)
  const fuel = isCarFuelKind(draft.fuelKind) ? { fuelKind: draft.fuelKind } : {}

  const list = [...(cars || [])]
  const duplicate = list.some((car) => car.number === number && (!editingId || car.id !== editingId))
  if (duplicate) return { error: '이미 등록된 차량번호입니다.', cars }

  if (editingId) {
    const idx = list.findIndex((car) => car.id === editingId)
    if (idx < 0) return { error: '차량을 찾지 못했습니다.', cars }
    const othersHaveMain = list.some((car, i) => i !== idx && car.type === 'main')
    if (type === 'main' && othersHaveMain) {
      return { error: '메인 차량이 이미 등록되어 있습니다.', cars }
    }
    const next: CarLike = { ...list[idx], number, tonnage, type, ...extra, ...fuel }
    if (!fuel.fuelKind) delete next.fuelKind
    list[idx] = next
    return { cars: list }
  }

  if (type === 'main' && hasMainCar(list)) {
    return { error: '메인 차량이 이미 등록되어 있습니다.', cars }
  }

  list.push({
    id: `car_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    number,
    tonnage,
    ...extra,
    ...fuel,
  })
  return { cars: list }
}

export function validateDriverLinkFields(name: string, phone: string): string | null {
  return checkDriverLink(name, phone)?.message ?? null
}

export function removeCar(cars: Array<CarLike> | null | undefined, id: string) {
  return (cars || []).filter((car) => car.id !== id)
}

export function getShortCarNum(carNum?: string): string {
  if (!carNum || carNum === 'main') return carNum || ''
  const match = carNum.match(/\d{4}$/)
  return match ? match[0] : carNum
}

export function getCarBusinessInfo(car: CarLike | null | undefined, settings: FinanceSettings = {}) {
  const ownerBiz = {
    name: settings.bizName || '',
    bizNumber: settings.bizNumber || '',
    representative: settings.bizRepresentative || settings.userName || '',
    address: settings.bizAddress || '',
    bizType: settings.bizType || '',
    bizItem: settings.bizItem || '',
    email: settings.bizEmail || '',
  }
  if (!car || car.type !== 'sub') return { sameAsOwner: true, ...ownerBiz }

  const info = car.businessInfo
  if (!info || info.sameAsOwner) return { sameAsOwner: true, ...ownerBiz }

  return {
    sameAsOwner: false,
    name: info.name || '',
    bizNumber: info.bizNumber || '',
    representative: info.representative || '',
    address: info.address || '',
    bizType: info.bizType || '',
    bizItem: info.bizItem || '',
    email: info.email || '',
  }
}

export function isVehicleRevenueSharedWithOwner(car: CarLike | null | undefined) {
  return car?.shareRevenueWithOwner !== false
}

export function getVehicleSupplierIdentity(car: CarLike | null | undefined, settings: FinanceSettings = {}) {
  const ownerBiz = {
    sameAsOwner: true,
    name: settings.bizName || '',
    bizNumber: settings.bizNumber || '',
    representative: settings.bizRepresentative || settings.userName || '',
    address: settings.bizAddress || '',
    bizType: settings.bizType || '',
    bizItem: settings.bizItem || '',
    email: settings.bizEmail || '',
  }
  if (!car || car.type !== 'sub') {
    return { key: `owner:${ownerBiz.bizNumber || ownerBiz.name || 'default'}`, biz: ownerBiz, carLabel: '메인 차량', carNumber: null }
  }
  const biz = getCarBusinessInfo(car, settings)
  if (biz.sameAsOwner) {
    return { key: `owner:${ownerBiz.bizNumber || ownerBiz.name || 'default'}`, biz: ownerBiz, carLabel: car.number, carNumber: car.number }
  }
  const key = `car:${car.number}:${biz.bizNumber || biz.name || 'noinfo'}`
  return { key, biz, carLabel: biz.name ? `${biz.name}, ${car.number}` : car.number, carNumber: car.number }
}
