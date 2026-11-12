// @ts-check
import { getFixedRouteClient, resolveFixedUnitPrice } from '../../../domain/clients.ts'
import {
  callFareTotal,
  dayTripCount,
  getFixedCount,
  getPalletCount,
  isOffDay,
} from '../../../domain/day-record.ts'
import { monthSettlementSummary } from '../../../domain/monthSettlement.ts'
import { parseCurrencyValue } from '../../../domain/money.ts'
import {
  readOwnerCars,
  readOwnerClients,
  readOwnerExpenses,
  readOwnerProfile,
  readOwnerSettings,
  readOwnerWorkData,
} from '../../../data/store/ownerDataHooks.ts'

/** @typedef {import('../../../domain/clientTypes.ts').ClientLike} ClientLike */
/** @typedef {import('../../../domain/dayRecordTypes.ts').DayRecordLike} DayRecordLike */
/** @typedef {import('../../../domain/financeTypes.ts').CarLike} CarLike */
/** @typedef {ReturnType<typeof readOwnerProfile>} ProfileLike */

/**
 * @param {Record<string, DayRecordLike>|null|undefined} workData
 * @param {number} year
 * @param {number} monthIndex
 * @param {{ unitPrice?: number, fixedRouteClient?: ClientLike|null, showPallet?: boolean }} [options]
 * @returns {Array<{ day: number, isOff: boolean, workVal: number, palletCount: number, amount: number }>}
 */
export function buildReportDayRows(workData, year, monthIndex, options = {}) {
  const unitPrice = Number(options.unitPrice) || 0
  const showPallet = !!options.showPallet
  const palletUnitPrice = parseCurrencyValue(options.fixedRouteClient?.palletPrice)
  const lastDate = new Date(year, monthIndex + 1, 0).getDate()
  /** @type {Array<{ day: number, isOff: boolean, workVal: number, palletCount: number, amount: number }>} */
  const rows = []
  for (let day = 1; day <= lastDate; day += 1) {
    const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const record = workData?.[dateKey]
    if (!record) continue
    if (isOffDay(record)) {
      rows.push({ day, isOff: true, workVal: 0, palletCount: 0, amount: 0 })
      continue
    }
    const workVal = dayTripCount(record)
    const palletCount = showPallet ? getPalletCount(record) : 0
    const dayFare = getFixedCount(record) * unitPrice + callFareTotal(record)
    const amount = dayFare + palletCount * palletUnitPrice
    if (workVal > 0 || palletCount > 0) {
      rows.push({ day, isOff: false, workVal, palletCount, amount })
    }
  }
  return rows
}

/**
 * @param {CarLike|null} car
 * @param {ProfileLike} profile
 */
function withVehicleAccount(car, profile) {
  const info = car?.type === 'sub' && car.businessInfo && !car.businessInfo.sameAsOwner ? car.personalInfo : null
  if (!info || !(info.bank || info.account || info.accountHolder)) return profile
  return { ...profile, bankName: info.bank || '', accountNumber: info.account || '', accountHolder: info.accountHolder || '' }
}

/**
 * @param {string} ownerKey
 * @param {number} year
 * @param {number} monthIndex
 * @param {string} [logKey]
 */
export function buildMonthReport(ownerKey, year, monthIndex, expenses = readOwnerExpenses(ownerKey), cars = readOwnerCars(ownerKey), practiceSettings = readOwnerSettings(ownerKey), workData = readOwnerWorkData(ownerKey), clients = readOwnerClients(ownerKey), profile = readOwnerProfile(ownerKey), logKey = 'main') {
  void expenses
  const mainCar = (cars || []).find((car) => car.type === 'main') || cars[0] || null
  const fixedScopeKey = mainCar?.type === 'sub' ? String(mainCar.number || '') : ''
  const unitPrice = resolveFixedUnitPrice({ clients }, fixedScopeKey)
  const fixedRouteClient = getFixedRouteClient({ clients }, fixedScopeKey)
  const activeFixedOn = logKey === 'main' ? !!practiceSettings.fixedOn : !!practiceSettings.subFixedOn
  const showPallet = activeFixedOn && !!fixedRouteClient?.palletOn
  const settled = monthSettlementSummary(workData, year, monthIndex, {
    unitPrice,
    fixedRouteClient,
    activeFixedOn,
    clients,
  })
  const days = buildReportDayRows(workData, year, monthIndex, {
    unitPrice,
    fixedRouteClient,
    showPallet,
  })

  return {
    year,
    monthIndex,
    title: `${year}년 ${monthIndex + 1}월 운송비 내역서`,
    profile: withVehicleAccount(mainCar, profile),
    mainCar,
    days,
    showPallet,
    distanceKm: settled.distanceKm,
    trips: settled.trips,
    callTrips: settled.callTrips,
    fixedBaseFare: settled.fixedBaseFare,
    defaultBaseFare: settled.defaultBaseFare,
    fareByClient: settled.fareByClient,
    commissionByClient: settled.commissionByClient,
    commissionLabelByClient: settled.commissionLabelByClient,
    palletFare: settled.palletFare,
    vat: settled.vat,
    total: settled.total + settled.insuranceTotal,
  }
}
